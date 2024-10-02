#!/usr/local/bin/node
// @ts-check

import { execSync, spawn } from "child_process"
import fs from "fs"
import process from "process"
const INFO_LOG = "INFO";
const ERROR_LOG = "ERROR";

const simpleLogger = (type, level, message) => {
  const nowDate = new Date();
  const dateString = `${nowDate.getFullYear()}_${(nowDate.getMonth()+1).toString().padStart(2, '0')}_${nowDate.getDate()}`;
  const logDir = `/usr/src/app/aio_logs/${type}/${dateString}`;
  // const logDir = `./aio_logs/${type}/${dateString}`;
  fs.mkdirSync(logDir, { recursive: true })
  const logfile = `${logDir}/aio_${type}.log`;
  const messageTimeStamp = nowDate.toLocaleString();
  fs.appendFileSync(logfile, `${messageTimeStamp}, ${level.toUpperCase()}, ${message}${"\n"}`)
}

simpleLogger("aio", INFO_LOG, "Starting AIO")


const injectEnvironmentVariables = () => {
  const envFileContent = Object.entries(process.env)
    .filter(([env]) => env.startsWith("VITE_"))
    .map(([env, val]) => `${env}=${
      (val.startsWith("\"") && val.endsWith("\""))
        ? val
        : `"${val}"`
    }`)
    .join("\n")
  simpleLogger("aio", INFO_LOG, `Environment variables: ${envFileContent}`)

  fs.writeFileSync("build.env", envFileContent)

  execSync(`npx import-meta-env -x build.env -e build.env -p "/site/**/*"`)

  fs.rmSync("build.env")

  simpleLogger("aio", INFO_LOG, "Environment variables injected")
}

injectEnvironmentVariables()

function getMigrations() {
  try {
    const result = execSync('npx prisma migrate status --schema=./prisma/schema.prisma', { encoding: 'utf-8', cwd : "/dist/backend", stdio: 'inherit' });
    console.log(result);
    simpleLogger("prisma", INFO_LOG, result)
  } catch (error) {
    console.error('Error getting migrations:', error);
  }
}

function getPendingMigrations() {
  try {
    execSync('npx prisma migrate status --schema=./prisma/schema.prisma > pending.txt', { encoding: 'utf-8', cwd : "/dist/backend", stdio: 'ignore' });
    return true;
  } catch (error) {

    // 继续处理退出码为 1 的情况
    if (error.status === 1) {
      console.log('Prisma migrate status found issues, but this may not be a fatal error.');

      const result = fs.readFileSync('pending.txt', 'utf-8')
      console.log('Prisma migrate status output:', result);
      const pendingMigrations = result.match(/Pending migrations:\n([\s\S]*?)\n\n/);
      if (pendingMigrations) {
        console.log('Pending migrations:', pendingMigrations[1]);
        simpleLogger("prisma", INFO_LOG, `Pending migrations: ${pendingMigrations[1]}`)
        return true;
      } else {
        console.log('No pending migrations');
        simpleLogger("prisma", INFO_LOG, "No pending migrations")
        return false;
      }
    }

    console.error('Error getting pending migrations:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    console.error('Command failed with exit code:', error.status);
    console.error('stderr:', error.stderr ? error.stderr.toString() : 'No stderr');
    console.error('stdout:', error.stdout ? error.stdout.toString() : 'No stdout');
    simpleLogger("prisma", ERROR_LOG, error)
    process.exit()
  }
}

function migrate() {
  try {
    let migrateResult = execSync('npx prisma migrate deploy --schema=./prisma/schema.prisma', { encoding: 'utf-8', cwd : "/dist/backend", stdio: 'inherit' });
    simpleLogger("prisma", INFO_LOG, migrateResult ?? "Migrations applied successfully")
  } catch (error) {
    console.error('Error applying migrations:', error);
    simpleLogger("prisma", ERROR_LOG, `Error applying migrations: ${error}`)
    process.exit()
  }
}

if(getPendingMigrations() === true){
  simpleLogger("prisma", INFO_LOG, "Applying pending migrations")
  migrate();
}

/**
 *  Run a child process with a prefix for each line of output
 * @param command 'node' or 'caddy'
 * @param args arguments to pass to the command
 * @param prefix prefix to add to each line of output
 * @returns {ChildProcessWithoutNullStreams}
 */
function runChildProcessWithPrefix(command, args, prefix) {
  const childProcess = spawn(command, args);

  childProcess.stdout.on('data', (data) => {
    const output = data.toString().trim().split('\n');
    output.forEach((line) => {
      console.log(`${prefix} | ${line}`);
      simpleLogger(command, INFO_LOG, line)
    });
  });

  childProcess.stderr.on('data', (data) => {
    const error = data.toString().trim().split('\n');
    error.forEach((line) => {
      console.error(`${prefix} | ${line}`);
      simpleLogger(command, ERROR_LOG, line)
    });
  });

  childProcess.on('close', (code) => {
    console.log(`${prefix} Child process exited with code ${code}`);
    simpleLogger(command, INFO_LOG, `Child process exited with code ${code}`)
  });

  childProcess.on('error', (stuff) => {
    console.log("error")
    simpleLogger(command, ERROR_LOG, stuff)
    console.log(stuff)
    simpleLogger(command, ERROR_LOG, stuff)
  })

  return childProcess
}


const caddyFileName = 'aio-multiport-setup.Caddyfile'
simpleLogger("aio", INFO_LOG, `Using Caddyfile: ${caddyFileName}`)
simpleLogger("aio", INFO_LOG, "Starting Caddy")
const caddyProcess = runChildProcessWithPrefix("caddy", ["run", "--config", `/etc/caddy/${caddyFileName}`, "--adapter", "caddyfile"], "App/Admin Dashboard Caddy")
simpleLogger("aio", INFO_LOG, "Starting Backend Server")
const backendProcess = runChildProcessWithPrefix("node", ["/dist/backend/dist/main.js"], "Backend Server")



caddyProcess.on("exit", (code) => {
  console.log(`Exiting process because Caddy Server exited with code ${code}`)
  simpleLogger("caddy", INFO_LOG, `Exiting process because Caddy Server exited with code ${code}`)
  process.exit(code)
})

backendProcess.on("exit", (code) => {
  console.log(`Exiting process because Backend Server exited with code ${code}`)
  simpleLogger("backend", INFO_LOG, `Exiting process because Backend Server exited with code ${code}`)
  process.exit(code)
})

process.on('SIGINT', () => {
  console.log("SIGINT received, exiting...")
  simpleLogger("aio", INFO_LOG, "SIGINT received, exiting...")

  caddyProcess.kill("SIGINT")
  backendProcess.kill("SIGINT")

  process.exit(0)
})
