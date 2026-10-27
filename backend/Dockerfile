FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY LockoutBingo.Api.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_ENVIRONMENT=Production
# Render setea PORT; Program.cs lo toma automáticamente.
ENTRYPOINT ["dotnet", "LockoutBingo.Api.dll"]
