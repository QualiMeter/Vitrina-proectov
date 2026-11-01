# Visual Studio and NuGet setup

- Solution: `Vitrina.slnx` at repository root.
- Supported IDE: Visual Studio 2022 17.14 or newer, or Visual Studio 2026.
- SDK: .NET 10; `global.json` allows newer .NET 10 feature bands.
- Projects: `backend/Vitrina.Api` and `backend/Vitrina.Api.Tests`.
- Central package versions: `backend/Directory.Packages.props`.
- Local infrastructure: PostgreSQL, Redis and MinIO from `backend/docker-compose.yml`.
- API launch profile: `Vitrina.Api`, HTTP `http://localhost:5080`, Scalar `http://localhost:5080/scalar/v1`.

The Development launch profile sets `Database__BootstrapSchema=true` for a new local database. This is only for local Development. Never enable bootstrap on an existing production database.

## Selected stable package versions

| Package | Version |
|---|---:|
| Microsoft.AspNetCore.OpenApi | 10.0.14 |
| Microsoft.EntityFrameworkCore.Design | 10.0.14 |
| Microsoft.AspNetCore.Identity.EntityFrameworkCore | 10.0.14 |
| Microsoft.Extensions.Caching.StackExchangeRedis | 10.0.14 |
| Microsoft.AspNetCore.SignalR.StackExchangeRedis | 10.0.14 |
| Npgsql.EntityFrameworkCore.PostgreSQL | 10.0.3 |
| Scalar.AspNetCore | 2.18.7 |
| Serilog.AspNetCore | 10.0.0 |
| Serilog.Sinks.Console | 6.1.1 |
| FluentValidation.DependencyInjectionExtensions | 12.2.0 |
| StackExchange.Redis | 3.4.29 |
| Minio | 7.0.0 |
| MailKit | 4.18.2 |
| Microsoft.NET.Test.Sdk | 18.11.0 |
| Microsoft.AspNetCore.Mvc.Testing | 10.0.14 |
| Testcontainers.PostgreSql | 4.16.0 |
| xunit.v3 | 4.0.2 |
| xunit.runner.visualstudio | 4.0.1 |

Versions were checked against NuGet package listings on 2026-11-01. Only stable versions are selected.


`MailKit` is pinned to 4.18.2 or newer as requested; `StackExchange.Redis` is pinned to 3.4.29. Versions are centrally managed in `backend/Directory.Packages.props`.

## PostgreSQL login

The configured PostgreSQL login is `postgres`. For a fresh local Compose volume, `backend/docker-compose.yml` initializes this user. If an older local volume was initialized with `POSTGRES_USER=vitrina`, either keep the data and rename that role from the running container (`ALTER ROLE vitrina RENAME TO postgres; ALTER ROLE postgres WITH PASSWORD 'vitrina';`) or, only when the database contains no data worth keeping, remove the old volume and recreate it. Changing `POSTGRES_USER` does not modify an already initialized PostgreSQL volume.
