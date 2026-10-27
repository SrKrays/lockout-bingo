using Microsoft.EntityFrameworkCore;

namespace LockoutBingo.Api.Data;

public class BingoDb(DbContextOptions<BingoDb> options) : DbContext(options)
{
    public DbSet<BoardTemplate> Templates => Set<BoardTemplate>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Player> Players => Set<Player>();
    public DbSet<Claim> Claims => Set<Claim>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<BoardTemplate>(e =>
        {
            e.ToTable("templates");
            e.Property(x => x.Name).HasMaxLength(80);
            e.Property(x => x.Description).HasMaxLength(300);
            e.Property(x => x.Goals).HasColumnType("text[]");
        });

        b.Entity<Room>(e =>
        {
            e.ToTable("rooms");
            e.HasKey(x => x.Code);
            e.Property(x => x.Code).HasMaxLength(8);
            e.Property(x => x.Name).HasMaxLength(80);
            e.Property(x => x.WinCondition).HasMaxLength(16);
            e.Property(x => x.Squares).HasColumnType("text[]");
            e.HasMany(x => x.Players).WithOne().HasForeignKey(p => p.RoomCode).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Claims).WithOne().HasForeignKey(c => c.RoomCode).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Player>(e =>
        {
            e.ToTable("players");
            e.Property(x => x.Name).HasMaxLength(24);
            e.Property(x => x.Color).HasMaxLength(9);
        });

        b.Entity<Claim>(e =>
        {
            e.ToTable("claims");
            e.HasIndex(x => new { x.RoomCode, x.Index }).IsUnique();
        });
    }
}
