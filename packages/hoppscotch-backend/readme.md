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
```

test Postgres connection

```shell
telnet 172.26.48.1 15432
```
