using LockoutBingo.Api.Data;

namespace LockoutBingo.Api.Game;

public record PlayerDto(Guid Id, string Name, string Color, int Count);
public record ClaimDto(int Index, Guid PlayerId);
public record RoomState(
    string Code,
    string Name,
    int Size,
    List<string> Squares,
    string WinCondition,
    List<PlayerDto> Players,
    List<ClaimDto> Claims,
    string Status,          // "playing" | "won" | "draw"
    Guid? WinnerId,
    List<int> WinningLine);

public static class GameRules
{
    public static readonly string[] WinConditions = ["lockout", "line", "blackout"];

    /// <summary>Calcula el estado completo (incluido el ganador) a partir de las casillas marcadas.</summary>
    public static RoomState BuildState(Room room)
    {
        var total = room.Size * room.Size;
        var owner = new Guid?[total];
        foreach (var c in room.Claims.Where(c => c.Index >= 0 && c.Index < total))
            owner[c.Index] = c.PlayerId;

        var counts = room.Players.ToDictionary(p => p.Id, p => room.Claims.Count(c => c.PlayerId == p.Id));
        var unclaimed = owner.Count(o => o is null);

        string status = "playing";
        Guid? winner = null;
        var line = new List<int>();

        switch (room.WinCondition)
        {
            case "line":
                foreach (var l in Lines(room.Size))
                {
                    var first = owner[l[0]];
                    if (first is not null && l.All(i => owner[i] == first))
                    {
                        status = "won"; winner = first; line = l; break;
                    }
                }
                if (winner is null && unclaimed == 0) status = "draw";
                break;

            case "blackout":
                if (unclaimed == 0) (status, winner) = MostSquares(counts);
                break;

            default: // lockout: ganás cuando nadie te puede alcanzar aunque se lleve todo lo libre
                var ranked = counts.OrderByDescending(kv => kv.Value).ToList();
                if (ranked.Count > 0)
                {
                    var lead = ranked[0];
                    var second = ranked.Count > 1 ? ranked[1].Value : 0;
                    if (lead.Value > 0 && lead.Value > second + unclaimed)
                    {
                        status = "won"; winner = lead.Key;
                    }
                    else if (unclaimed == 0)
                    {
                        (status, winner) = MostSquares(counts);
                    }
                }
                break;
        }

        return new RoomState(
            room.Code,
            room.Name,
            room.Size,
            room.Squares,
            room.WinCondition,
            room.Players.OrderBy(p => p.JoinedAt).Select(p => new PlayerDto(p.Id, p.Name, p.Color, counts[p.Id])).ToList(),
            room.Claims.OrderBy(c => c.Index).Select(c => new ClaimDto(c.Index, c.PlayerId)).ToList(),
            status,
            winner,
            line);
    }

    private static (string, Guid?) MostSquares(Dictionary<Guid, int> counts)
    {
        var ranked = counts.OrderByDescending(kv => kv.Value).ToList();
        if (ranked.Count == 0) return ("draw", null);
        if (ranked.Count > 1 && ranked[0].Value == ranked[1].Value) return ("draw", null);
        return ("won", ranked[0].Key);
    }

    /// <summary>Filas, columnas y las dos diagonales.</summary>
    public static IEnumerable<List<int>> Lines(int n)
    {
        for (var r = 0; r < n; r++) yield return Enumerable.Range(0, n).Select(c => r * n + c).ToList();
        for (var c = 0; c < n; c++) yield return Enumerable.Range(0, n).Select(r => r * n + c).ToList();
        yield return Enumerable.Range(0, n).Select(i => i * n + i).ToList();
        yield return Enumerable.Range(0, n).Select(i => i * n + (n - 1 - i)).ToList();
    }

    private const string CodeChars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I/L

    public static string NewCode() =>
        new(Enumerable.Range(0, 6).Select(_ => CodeChars[Random.Shared.Next(CodeChars.Length)]).ToArray());

    /// <summary>Arma el tablero: mezcla el pool de objetivos y toma Size² casillas.</summary>
    public static List<string> PickSquares(IEnumerable<string> goals, int size, bool shuffle)
    {
        var pool = goals.Select(g => g.Trim()).Where(g => g.Length > 0).Distinct().ToList();
        if (shuffle) pool = pool.OrderBy(_ => Random.Shared.Next()).ToList();
        return pool.Take(size * size).ToList();
    }
}
