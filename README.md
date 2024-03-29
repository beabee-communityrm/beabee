# beabee

This repository hosts beabee's API and legacy app. [Go here](https://beabee.io/en/home/) to find out more about beabee.

If you are interested/have any questions please contact
will.franklin@beabee.io, I'd love to hear from you!

This system was originally created for
[South London Makerspace](http://southlondonmakerspace.org)
and repurposed by [The Bristol Cable](https://thebristolcable.org).

![Deploy](https://github.com/beabee-communityrm/beabee/workflows/Deploy/badge.svg)
![Known Vulnerabilities](https://snyk.io/test/github/beabee-communityrm/beabee/badge.svg?targetFile=package.json)

Browser testing with<br/>
<a href="https://www.browserstack.com/"><img src="https://user-images.githubusercontent.com/2084823/46341120-52388b00-c62f-11e8-8f41-270915ccc03b.png" width="150" /></a>

## Install

> ⚠️⚠️⚠️ **WARNING** ⚠️⚠️⚠️
>
> If you want to deploy beabee on a server refer to
> [beabee/beabee-deploy](https://github.com/beabee-communityrm/beabee-deploy/)
> instead. The instructions below are for running beabee locally for development

You need:

- Docker >= 19.03.8
- Docker Compose >= 2
- Node.js >= 20.10.0

NOTE: Lower non-major versions probably work but haven't been tested

To just look around the system you can just use the example env file (`.env.example`) as is, but you'll need to
create a sandbox GoCardless account to test any payment flows.

```bash
cp .env.example .env

npm install
npm run build
docker compose build

# Initialise database
docker compose up -d db
docker compose run --rm app npm run typeorm migration:run

# Do the rest
docker compose up -d
```

Go to: http://localhost:3001

### To get started

#### Create a new super admin

```bash
docker compose run --rm app node built/tools/new-user
```

#### Import some data

Need some test data? Download it here: coming soon

```bash
docker compose run --rm -T app node built/tools/database/import.js < <import file>
```

## Development

Development is containerized, in general you should be able to use the following to get started

```bash
npm start
```

You can also use the following when just working on the API (faster reloading)

```bash
npm run dev:api
```

#### Rebuilding containers

If you make changes to `.env` you need to recreate the Docker containers

```
docker compose up -d
```

If you change the dependencies in `package.json` you must rebuild and recreate the Docker containers

```
docker compose build
docker compose up -d
```

#### Generating database migrations

Whenever you make changes to a database model, you need to create a migration
file. TypeORM will automatically generate a migration file based on your schema
changes

```
docker compose start db
docker compose run app npm run typeorm migration:generate src/migrations/MigrationName
npm run build
docker compose run app npm run typeorm migration:run
```

> Note: If you get an `EACCES: permission denied` error, you may need to run the above commands with `docker compose run -u root`.

### Documentation

Documentation is currently very limited, email [will.franklin@beabee.io](mailto:will.franklin@beabee.io) if you have any questions.

The codebase is broadly split into a few different parts

- **beabee core**

  Shared between all services (API, webhooks and legacy)

  ```
  ./src/core
  ./src/models - Data models and database entities
  ./src/config - Config loader
  ```

- **API service**
  ```
  ./src/api
  ```
- **Webhook service**

  Handlers for webhooks from beabee's integrations (currently GoCardless, Mailchimp and Stripe)

  ```
  ./src/webhook
  ```

- **Legacy app**

  This is slowly being removed, with business logic being moved into the API and frontend into the [new frontend](https://github.com/beabee-communityrm/beabee-frontend/).

  ```
  ./src/apps
  ./src/static
  ./src/views
  ```

- **Tools**

  Various tools for administration, including nightly cron jobs

  ```
  ./src/tools
  ```

- **Database migrations**

  Autogenerated by TypeORM

  ```
  ./src/migrations
  ```
