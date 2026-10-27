namespace LockoutBingo.Api.Data;

/// <summary>Plantilla reutilizable: una lista de objetivos de la que se arman tableros.</summary>
public class BoardTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public List<string> Goals { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Una partida en vivo. El tablero queda fijo al crearse.</summary>
public class Room
{
    /// <summary>Código corto que se comparte con los amigos (ej: K7QX2M).</summary>
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public int Size { get; set; } = 5;
    /// <summary>Casillas en orden fila por fila. Length = Size * Size.</summary>
    public List<string> Squares { get; set; } = new();
    /// <summary>"lockout" (mayoría inalcanzable), "line" (primera línea) o "blackout" (todas).</summary>
    public string WinCondition { get; set; } = "lockout";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<Player> Players { get; set; } = new();
    public List<Claim> Claims { get; set; } = new();
}

public class Player
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string RoomCode { get; set; } = "";
    public string Name { get; set; } = "";
    public string Color { get; set; } = "#ff4d6d";
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Una casilla marcada. El índice único (RoomCode, Index) es lo que hace el "lockout":
/// si dos jugadores marcan la misma casilla al mismo tiempo, la base rechaza al segundo.
/// </summary>
public class Claim
{
    public long Id { get; set; }
    public string RoomCode { get; set; } = "";
    public int Index { get; set; }
    public Guid PlayerId { get; set; }
    public DateTime ClaimedAt { get; set; } = DateTime.UtcNow;
}
