FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["Directory.Packages.props", "./"]
COPY ["Vitrina.Api/Vitrina.Api.csproj", "Vitrina.Api/"]
RUN dotnet restore "Vitrina.Api/Vitrina.Api.csproj"
COPY . .
WORKDIR /src/Vitrina.Api
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Vitrina.Api.dll"]
