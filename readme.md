# Membership System

This is The Bristol Cable's membership system. We are actively looking for
people/organisations who are interested in using the system or want to get
involved.

<b>If you are interested/have any questions please contact
will@thebristolcable.org, I'd love to hear from you!</b>

This system was originally created for
[South London Makerspace](http://southlondonmakerspace.org)
and repurposed by [The Bristol Cable](https://thebristolcable.org).

### Integrations

- GoCardless for direct debits
- MailChimp for newsletters
- Mandrill for transactional emails
- Discourse with SSO for forums

[![Deployment](https://circleci.com/gh/thebristolcable/membership-system.svg?style=shield)](https://circleci.com/gh/thebristolcable/membership-system)
[![Known Vulnerabilities](https://snyk.io/test/github/thebristolcable/membership-system/badge.svg?targetFile=package.json)](https://snyk.io/test/github/thebristolcable/membership-system?targetFile=package.json)

Browser testing with<br/>
<a href="https://www.browserstack.com/"><img src="https://user-images.githubusercontent.com/2084823/46341120-52388b00-c62f-11e8-8f41-270915ccc03b.png" width="150" /></a>

## Install

You must have the following installed:

- Node.js >= 12.16.1
- Docker >= 19.03.8
- Docker Compose >= 1.25.5

NOTE: Lower non-major versions probably work but haven't been tested

### From scratch (no data export)

1. Install dependencies
   ```bash
   npm install
   ```

1. Copy and fill in the config file
   ```bash
   cp config/example-config.json config/config.json
   ```

1. Set up the basics
   ```bash
   docker-compose up -d
   docker-compose exec app node tools/first-time
   ```

1. Set `permission.memberId` in `config/config.json` as indicated and apply
   changes
   ```bash
   docker-compose restart
   ```

1. Create a new super admin
   ```bash
   docker-compose exec app node tools/new-user
   ```

### With data export

1. Install dependencies
   ```bash
   npm install
   ```

1. Copy and fill in the config file
   ```bash
   cp config/example-config.json config/config.json
   ```

1. Set up the basics
   ```bash
   docker-compose up -d
   ```

1. Import the data export
   ```
   docker-compose exec app node tools/database/import.js <import path>
   ```

   NOTE: `<import path>` must be inside the repo's root directory so it is
   visible to the Docker container

## Development

```
npm start
```

Go to `http://localhost:3001`

#### Creating apps
The system is built around modular apps. If you're looking to add functionality
to the site the best way to do this would by adding an app to the site rather
than modifying it's base. This means you're unlikely to mess anything up.

As an example, let's add a login page.

Stub out your app structure within `app/`, this will include:

```
apps/
	login/
		views/
			index.pug
		app.js
		config.js
```

Check out these files to get an idea of how each of these should be structure.
