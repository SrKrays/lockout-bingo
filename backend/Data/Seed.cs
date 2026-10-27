using Microsoft.EntityFrameworkCore;

namespace LockoutBingo.Api.Data;

/// <summary>Plantillas de arranque. Sólo se cargan si la tabla está vacía.</summary>
public static class Seed
{
    public static async Task RunAsync(BingoDb db)
    {
        if (await db.Templates.AnyAsync()) return;

        db.Templates.AddRange(
            new BoardTemplate
            {
                Name = "Minecraft Lockout",
                Description = "El clásico: mundo nuevo, misma seed, el primero que lo logra se queda la casilla.",
                Goals =
                [
                    "Craftear una mesa de encantamientos", "Conseguir un diamante", "Matar un creeper", "Domesticar un lobo",
                    "Entrar al Nether", "Conseguir una vara de blaze", "Craftear un escudo", "Comer una torta",
                    "Pescar un pez globo", "Conseguir una perla de Ender", "Hacer un portal del Nether", "Craftear un reloj",
                    "Craftear una brújula", "Conseguir 64 bloques de tierra", "Dormir en una cama", "Montar un caballo",
                    "Conseguir obsidiana", "Hacer una poción", "Matar un enderman", "Encontrar una aldea",
                    "Tradear con un aldeano", "Conseguir un huevo de tortuga", "Craftear un mapa", "Matar un esqueleto con su propia flecha",
                    "Craftear armadura de hierro completa", "Conseguir lana de 5 colores", "Encontrar un templo del desierto", "Usar un cubo de lava",
                    "Craftear un jukebox", "Criar dos vacas", "Conseguir una manzana dorada", "Encontrar un fuerte del Nether",
                    "Morir por caída", "Craftear una ballesta", "Conseguir miel", "Teñir un cartel con tinta luminosa",
                ],
            },
            new BoardTemplate
            {
                Name = "Valorant Lockout",
                Description = "Para jugar en la misma partida o en paralelo. Gana el que cumple más primero.",
                Goals =
                [
                    "Hacer un ace", "Ganar un clutch 1v2", "Ganar un clutch 1v3", "Matar con el cuchillo",
                    "Ganar una ronda pistolera", "Plantear la spike 3 veces en una partida", "Defusear la spike", "Matar a través de una pared",
                    "Hacer 3 headshots seguidos", "Ganar una ronda eco", "Matar con una Operator", "Matar con una Sheriff",
                    "Terminar top frag", "Hacer 25 kills", "Ganar la partida", "Hacer un ninja defuse",
                    "Matar con habilidad", "Conseguir 10 asistencias en una partida", "Matar al último enemigo de la ronda", "Ganar 5 rondas seguidas",
                    "Comprar el arma de un compañero", "Matar a 2 en menos de 1 segundo", "Hacer un first blood", "No morir en toda una ronda de ataque",
                    "Matar con una Odin", "Jugar un agente que nunca usaste", "Ganar una ronda sin disparar", "Sobrevivir con 1 de vida",
                    "Hacer un MVP", "Matar a un enemigo flasheado",
                ],
            },
            new BoardTemplate
            {
                Name = "Juntada / previa",
                Description = "Para una noche con amigos. Gana quien cumple primero, sin trampas.",
                Goals =
                [
                    "Alguien llega tarde", "Se pide delivery", "Alguien se duerme", "Se pone un tema de cuarteto",
                    "Alguien cuenta la misma anécdota de siempre", "Se rompe un vaso", "Alguien saca la guitarra", "Se habla de un ex",
                    "Alguien se va antes de las 2", "Se arma un truco", "Alguien saca fotos grupales", "Se termina el hielo",
                    "Alguien pide que bajen la música", "Llega un vecino a quejarse", "Alguien hace un brindis", "Se discute de fútbol",
                    "Alguien pierde el celular", "Se canta el feliz cumpleaños (sin que sea cumpleaños)", "Aparece un perro", "Alguien se olvida algo al irse",
                    "Se juega a algún juego de mesa", "Alguien se queda sin batería", "Se cuenta un chiste malísimo", "Alguien llora de risa",
                    "Se pone un tema de los 2000", "Se arma un fernet", "Alguien dice 'la última y me voy'", "Hay un debate sin sentido que dura más de 10 min",
                ],
            });

        await db.SaveChangesAsync();
    }
}
