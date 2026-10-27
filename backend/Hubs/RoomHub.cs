using LockoutBingo.Api.Data;
using LockoutBingo.Api.Game;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace LockoutBingo.Api.Hubs;

/// <summary>
/// Tiempo real de la sala. Cada cambio vuelve a mandar el estado completo a todo el grupo:
/// el tablero es chico (máx 49 casillas), así que es más simple y robusto que mandar deltas.
/// </summary>
public class RoomHub(BingoDb db) : Hub
{
    public async Task<RoomState> JoinRoom(string code)
    {
        var room = await Load(code);
        await Groups.AddToGroupAsync(Context.ConnectionId, room.Code);
        return GameRules.BuildState(room);
    }

    public async Task LeaveRoom(string code) =>
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, code.ToUpperInvariant());

    public async Task Claim(string code, Guid playerId, int index)
    {
        var room = await Load(code);
        EnsurePlayer(room, playerId);
        if (index < 0 || index >= room.Squares.Count) throw new HubException("Casilla inválida.");
        if (GameRules.BuildState(room).Status != "playing") throw new HubException("La partida ya terminó.");
        if (room.Claims.Any(c => c.Index == index)) throw new HubException("¡Tarde! Esa casilla ya está tomada.");

        db.Claims.Add(new Claim { RoomCode = room.Code, Index = index, PlayerId = playerId });
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Dos clicks al mismo tiempo: el índice único deja pasar sólo al primero.
            throw new HubException("¡Tarde! Esa casilla ya está tomada.");
        }

        await Broadcast(room.Code);
    }

    /// <summary>Desmarcar una casilla propia (por si alguien se equivocó).</summary>
    public async Task Unclaim(string code, Guid playerId, int index)
    {
        var room = await Load(code);
        EnsurePlayer(room, playerId);
        var claim = room.Claims.FirstOrDefault(c => c.Index == index)
            ?? throw new HubException("Esa casilla no está marcada.");
        if (claim.PlayerId != playerId) throw new HubException("Sólo podés desmarcar tus casillas.");

        db.Claims.Remove(claim);
        await db.SaveChangesAsync();
        await Broadcast(room.Code);
    }

    /// <summary>Revancha: borra las marcas y, si se pide, mezcla las casillas de lugar.</summary>
    public async Task Reset(string code, bool reshuffle)
    {
        var room = await Load(code);
        db.Claims.RemoveRange(room.Claims);
        if (reshuffle) room.Squares = room.Squares.OrderBy(_ => Random.Shared.Next()).ToList();
        await db.SaveChangesAsync();
        await Broadcast(room.Code);
    }

    private async Task Broadcast(string code)
    {
        db.ChangeTracker.Clear();
        var room = await Load(code);
        await Clients.Group(room.Code).SendAsync("State", GameRules.BuildState(room));
    }

    private async Task<Room> Load(string code)
    {
        var key = code.Trim().ToUpperInvariant();
        return await db.Rooms
            .Include(r => r.Players)
            .Include(r => r.Claims)
            .AsSplitQuery()
            .FirstOrDefaultAsync(r => r.Code == key)
            ?? throw new HubException("No existe una sala con ese código.");
    }

    private static void EnsurePlayer(Room room, Guid playerId)
    {
        if (room.Players.All(p => p.Id != playerId))
            throw new HubException("No estás en esta sala. Volvé a entrar con tu nombre.");
    }
}
