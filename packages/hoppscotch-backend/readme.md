# start development environment

load environment variables

```shell
source .env
```

check if the environment variables are loaded

```shell
echo $DATABASE_URL
```

start the development server

```shell
pnpm run start:dev
pnpm run start:debug
```

test Postgres connection

```shell
telnet 172.26.48.1 15432
```

# graphql

generate schema

```shell
pnpm run generate-gql-sdl
```

# prisma commands

## change schema

create a new migration after changing the schema

```shell
prisma migrate dev --name "migration name"
```

then

```shell
npx prisma generate
```
