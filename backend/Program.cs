using LockoutBingo.Api.Data;
using LockoutBingo.Api.Game;
using LockoutBingo.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Render (y similares) pasan el puerto por la variable PORT.
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port)) builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.AddDbContext<BingoDb>(o => o.UseNpgsql(ConnectionStringFrom(builder.Configuration)));
builder.Services.AddSignalR();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

var origins = (builder.Configuration["AllowedOrigins"] ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();
app.UseCors();

// Proyecto chico: creamos el esquema al arrancar en vez de usar migraciones.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BingoDb>();
    await db.Database.EnsureCreatedAsync();
    await Seed.RunAsync(db);
}

app.MapGet("/", () => Results.Ok(new { app = "Lockout Bingo API", ok = true }));

// ---------- Plantillas (pools de objetivos reutilizables) ----------
var templates = app.MapGroup("/api/templates");

templates.MapGet("/", async (BingoDb db) =>
    await db.Templates.OrderByDescending(t => t.UpdatedAt)
        .Select(t => new { t.Id, t.Name, t.Description, GoalCount = t.Goals.Count, t.UpdatedAt })
        .ToListAsync());

templates.MapGet("/{id:guid}", async (Guid id, BingoDb db) =>
    await db.Templates.FindAsync(id) is { } t ? Results.Ok(t) : Results.NotFound());

templates.MapPost("/", async (TemplateInput input, BingoDb db) =>
{
    if (input.Validate() is { } error) return Results.BadRequest(new { error });
    var t = new BoardTemplate { Name = input.Name.Trim(), Description = input.Description?.Trim() ?? "", Goals = input.CleanGoals() };
    db.Templates.Add(t);
    await db.SaveChangesAsync();
    return Results.Created($"/api/templates/{t.Id}", t);
});

templates.MapPut("/{id:guid}", async (Guid id, TemplateInput input, BingoDb db) =>
{
    if (input.Validate() is { } error) return Results.BadRequest(new { error });
    var t = await db.Templates.FindAsync(id);
    if (t is null) return Results.NotFound();
    t.Name = input.Name.Trim();
    t.Description = input.Description?.Trim() ?? "";
    t.Goals = input.CleanGoals();
    t.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(t);
});

templates.MapDelete("/{id:guid}", async (Guid id, BingoDb db) =>
{
    var deleted = await db.Templates.Where(t => t.Id == id).ExecuteDeleteAsync();
    return deleted > 0 ? Results.NoContent() : Results.NotFound();
});

// ---------- Salas ----------
var rooms = app.MapGroup("/api/rooms");

rooms.MapPost("/", async (CreateRoomInput input, BingoDb db) =>
{
    var size = Math.Clamp(input.Size, 3, 7);
    var squares = GameRules.PickSquares(input.Goals ?? [], size, input.Shuffle);
    if (squares.Count < size * size)
        return Results.BadRequest(new { error = $"Para un tablero {size}x{size} necesitás al menos {size * size} objetivos distintos (tenés {squares.Count})." });
    if (squares.Any(s => s.Length > 120))
        return Results.BadRequest(new { error = "Cada objetivo puede tener hasta 120 caracteres." });

    var win = GameRules.WinConditions.Contains(input.WinCondition) ? input.WinCondition : "lockout";

    string code;
    do code = GameRules.NewCode(); while (await db.Rooms.AnyAsync(r => r.Code == code));

    var room = new Room
    {
        Code = code,
        Name = string.IsNullOrWhiteSpace(input.Name) ? "Lockout Bingo" : input.Name.Trim()[..Math.Min(80, input.Name.Trim().Length)],
        Size = size,
        Squares = squares,
        WinCondition = win,
    };
    db.Rooms.Add(room);
    await db.SaveChangesAsync();
    return Results.Created($"/api/rooms/{code}", GameRules.BuildState(room));
});

rooms.MapGet("/{code}", async (string code, BingoDb db) =>
{
    var room = await LoadRoom(db, code);
    return room is null ? Results.NotFound(new { error = "No existe una sala con ese código." }) : Results.Ok(GameRules.BuildState(room));
});

rooms.MapPost("/{code}/players", async (string code, JoinInput input, BingoDb db, IHubContext<RoomHub> hub) =>
{
    var room = await LoadRoom(db, code);
    if (room is null) return Results.NotFound(new { error = "No existe una sala con ese código." });

    var name = (input.Name ?? "").Trim();
    if (name.Length is 0 or > 24) return Results.BadRequest(new { error = "Poné un nombre de 1 a 24 caracteres." });
    if (room.Players.Count >= 8) return Results.BadRequest(new { error = "La sala está llena (máx. 8 jugadores)." });
    if (room.Players.Any(p => p.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
        return Results.Conflict(new { error = "Ya hay alguien con ese nombre en la sala." });

    var color = IsHexColor(input.Color) ? input.Color! : "#ff4d6d";
    if (room.Players.Any(p => p.Color.Equals(color, StringComparison.OrdinalIgnoreCase)))
        return Results.Conflict(new { error = "Ese color ya lo eligió otro jugador." });

    var player = new Player { RoomCode = room.Code, Name = name, Color = color };
    db.Players.Add(player);
    await db.SaveChangesAsync();

    // EF ya agrega el jugador a room.Players al guardar (relationship fix-up).
    await hub.Clients.Group(room.Code).SendAsync("State", GameRules.BuildState(room));
    return Results.Ok(new { player.Id, player.Name, player.Color });
});

app.MapHub<RoomHub>("/hubs/room");

app.Run();

// ---------- helpers ----------
static Task<Room?> LoadRoom(BingoDb db, string code) =>
    db.Rooms.Include(r => r.Players).Include(r => r.Claims).AsSplitQuery()
        .FirstOrDefaultAsync(r => r.Code == code.Trim().ToUpper());

static bool IsHexColor(string? c) =>
    c is { Length: 7 } && c[0] == '#' && c[1..].All(Uri.IsHexDigit);

/// <summary>Acepta ConnectionStrings:Default o DATABASE_URL (formato postgres:// de Render).</summary>
static string ConnectionStringFrom(IConfiguration config)
{
    var url = Environment.GetEnvironmentVariable("DATABASE_URL");
    if (string.IsNullOrEmpty(url))
        return config.GetConnectionString("Default") ?? throw new InvalidOperationException("Falta la cadena de conexión.");

    var uri = new Uri(url);
    var userInfo = uri.UserInfo.Split(':', 2);
    var dbPort = uri.Port > 0 ? uri.Port : 5432;
    return $"Host={uri.Host};Port={dbPort};Database={uri.AbsolutePath.TrimStart('/')};" +
           $"Username={Uri.UnescapeDataString(userInfo[0])};Password={Uri.UnescapeDataString(userInfo.ElementAtOrDefault(1) ?? "")};" +
           "SSL Mode=Prefer;Trust Server Certificate=true";
}

record TemplateInput(string Name, string? Description, List<string>? Goals)
{
    public List<string> CleanGoals() =>
        (Goals ?? []).Select(g => g.Trim()).Where(g => g.Length > 0).Distinct().Take(200).ToList();

    public string? Validate()
    {
        if (string.IsNullOrWhiteSpace(Name) || Name.Trim().Length > 80) return "El nombre tiene que tener entre 1 y 80 caracteres.";
        if (CleanGoals().Count < 9) return "Una plantilla necesita al menos 9 objetivos (tablero 3x3).";
        if (CleanGoals().Any(g => g.Length > 120)) return "Cada objetivo puede tener hasta 120 caracteres.";
        return null;
    }
}

record CreateRoomInput(string? Name, List<string>? Goals, int Size = 5, string WinCondition = "lockout", bool Shuffle = true);
record JoinInput(string? Name, string? Color);
