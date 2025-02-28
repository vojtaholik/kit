import {
  Script,
  PromptConfig,
  ScriptPathInfo,
  ScriptMetadata,
  Metadata,
} from "../types/core"
import * as path from "path"
import * as os from "os"
import { lstatSync } from "fs"
import { readFile, readdir, lstat } from "fs/promises"
import { execSync } from "child_process"
import { config } from "dotenv-flow"

import { ProcessType, UI, Bin, Channel } from "./enum.js"
import { getScripts, getScriptFromString } from "./db.js"

export let extensionRegex = /\.(mjs|ts|js)$/g

export let home = (...pathParts: string[]) => {
  return path.resolve(os.homedir(), ...pathParts)
}

export let wait = async (time: number): Promise<void> =>
  new Promise(res => setTimeout(res, time))

export let checkProcess = (pid: string | number) => {
  return execSync(`kill -0 ` + pid).buffer.toString()
}

export let isFile = async (
  file: string
): Promise<boolean> => {
  try {
    let stats = await lstat(file)
    return stats.isFile()
  } catch {
    return false
  }
}

export let isDir = async (
  dir: string
): Promise<boolean> => {
  try {
    let stats = await lstat(dir)

    return stats.isDirectory()
  } catch {
    return false
  }
}

export let isBin = async (
  bin: string
): Promise<boolean> => {
  try {
    return Boolean(execSync(`command -v ${bin}`))
  } catch {
    return false
  }
}

export let kitPath = (...parts: string[]) =>
  path.join(
    process.env.KIT || home(".kit"),
    ...parts.filter(Boolean)
  )

export let kenvPath = (...parts: string[]) => {
  return path.join(
    process.env.KENV || home(".kenv"),
    ...parts.filter(Boolean)
  )
}

export let kitDotEnvPath = () => {
  return process.env.KIT_DOTENV_PATH || kenvPath()
}

export const outputTmpFile = async (
  fileName: string,
  contents: string
) => {
  let outputPath = path.resolve(
    global.tempdir(),
    "kit",
    fileName
  )
  await global.outputFile(outputPath, contents)
  return outputPath
}

export const copyTmpFile = async (
  fromFile: string,
  fileName: string
) =>
  await outputTmpFile(
    fileName,
    await readFile(fromFile, "utf-8")
  )

export const prefsPath = kitPath("db", "prefs.json")
export const shortcutsPath = kitPath("db", "shortcuts.json")
export const promptDbPath = kitPath("db", "prompt.json")
export const appDbPath = kitPath("db", "app.json")
export const tmpClipboardDir = kitPath("tmp", "clipboard")
export const tmpDownloadsDir = kitPath("tmp", "downloads")
export const mainScriptPath = kitPath("main", "index.js")
export const execPath = kitPath("node", "bin", "node")

export const KENV_SCRIPTS = kenvPath("scripts")
export const KENV_APP = kenvPath("app")
export const KENV_BIN = kenvPath("bin")

export const KIT_APP = kitPath("run", "app.js")
export const KIT_APP_PROMPT = kitPath(
  "run",
  "app-prompt.js"
)
export const KIT_NODE_PATH =
  process.env.KIT_NODE_PATH || `${kitPath("node", "bin")}`

export const KIT_DEFAULT_PATH = `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`

export const KIT_FIRST_PATH = `${kitPath("bin")}${
  path.delimiter
}${kenvPath("bin")}${path.delimiter}${KIT_NODE_PATH}${
  path.delimiter
}${KIT_DEFAULT_PATH}`

export let assignPropsTo = (
  source: { [s: string]: unknown } | ArrayLike<unknown>,
  target: { [x: string]: unknown }
) => {
  Object.entries(source).forEach(([key, value]) => {
    target[key] = value
  })
}

let fileExists = (path: string) => {
  try {
    return lstatSync(path, {
      throwIfNoEntry: false,
    })?.isFile()
  } catch {
    return false
  }
}

export let resolveToScriptPath = (
  script: string,
  cwd: string = process.cwd()
): string => {
  let extensions = ["", ".js", ".ts"]
  let resolvedScriptPath = ""

  // if (!script.match(/(.js|.mjs|.ts)$/)) script += ".js"

  // Check main kenv

  for (let ext of extensions) {
    resolvedScriptPath = kenvPath("scripts", script + ext)
    if (fileExists(resolvedScriptPath))
      return resolvedScriptPath
  }

  // Check other kenvs
  let [k, s] = script.split("/")
  if (s) {
    for (let ext of extensions) {
      resolvedScriptPath = kenvPath(
        "kenvs",
        k,
        "scripts",
        s + ext
      )
      if (fileExists(resolvedScriptPath))
        return resolvedScriptPath
    }
  }

  // Check scripts dir

  for (let ext of extensions) {
    resolvedScriptPath = path.resolve(
      cwd,
      "scripts",
      script + ext
    )
    if (fileExists(resolvedScriptPath))
      return resolvedScriptPath
  }

  // Check anywhere

  for (let ext of extensions) {
    resolvedScriptPath = path.resolve(cwd, script + ext)
    if (fileExists(resolvedScriptPath))
      return resolvedScriptPath
  }

  throw new Error(`${script} not found`)
}

export let resolveScriptToCommand = (script: string) => {
  return script.replace(/.*\//, "").replace(".js", "")
}

export const shortcutNormalizer = (shortcut: string) =>
  shortcut
    ? shortcut
        .replace(/(option|opt)/i, "Alt")
        .replace(/(command|cmd)/i, "CommandOrControl")
        .replace(/(ctl|cntrl|ctrl)/, "Control")
        .split(/\s/)
        .filter(Boolean)
        .map(part =>
          (part[0].toUpperCase() + part.slice(1)).trim()
        )
        .join("+")
    : ""

export const friendlyShortcut = (shortcut: string) => {
  let f = ""
  if (shortcut.includes("CommandOrControl+")) f += "cmd+"
  if (shortcut.includes("Control+")) f += "ctrl+"
  if (shortcut.includes("Alt+")) f += "opt+"
  if (shortcut.includes("Shift+")) f += "shift+"
  if (shortcut.includes("+"))
    f += shortcut.split("+").pop()?.toLowerCase()

  return f
}

export let getMetadataByMarker =
  (fileContents: string) => (marker: string) =>
    fileContents
      .match(
        new RegExp(`(?<=^//\\s*${marker}\\s*).*`, "gim")
      )?.[0]
      .trim() || ""

export let getMetadata = (string: string): Metadata => {
  let matches = string.matchAll(
    /(?<=^\/\/)([^:]*)(?::)(.*)/gm
  )
  let metadata = {}
  for (let [, key, value] of matches) {
    let v = value.trim()
    if (v.length) {
      let k = key.trim()
      k = k[0].toLowerCase() + k.slice(1)
      metadata[k] = v
    }
  }

  return metadata
}

export let formatScriptMetadata = (
  metadata: Metadata,
  fileContents: string
): ScriptMetadata => {
  if (metadata?.shortcut) {
    metadata.shortcut = shortcutNormalizer(
      metadata?.shortcut
    )

    metadata.friendlyShortcut = friendlyShortcut(
      metadata.shortcut
    )
  }

  if (metadata?.shortcode) {
    ;(metadata as unknown as ScriptMetadata).shortcode =
      metadata?.shortcode
        ?.split(" ")
        .map(sc => sc.trim().toLowerCase())
  }

  if (metadata?.image) {
    metadata.img = metadata?.image
  }

  if (metadata?.timeout) {
    ;(metadata as unknown as ScriptMetadata).timeout =
      parseInt(metadata?.timeout, 10)
  }

  if (metadata?.exclude) {
    ;(metadata as unknown as ScriptMetadata).exclude =
      Boolean(metadata?.exclude === "true")
  }

  metadata.type = metadata?.schedule
    ? ProcessType.Schedule
    : metadata?.watch
    ? ProcessType.Watch
    : metadata?.system
    ? ProcessType.System
    : metadata?.background
    ? ProcessType.Background
    : ProcessType.Prompt

  let tabs =
    fileContents.match(
      new RegExp(`(?<=^onTab[(]['"]).*(?=\s*['"])`, "gim")
    ) || []

  if (tabs?.length) {
    ;(metadata as unknown as ScriptMetadata).tabs = tabs
  }

  let hasFlags = Boolean(
    fileContents.match(
      new RegExp(`(?<=^setFlags).*`, "gim")
    )
  )

  if (hasFlags) {
    ;(metadata as unknown as ScriptMetadata).hasFlags = true
  }

  let ui = (metadata?.ui ||
    fileContents
      .match(/(?<=await )arg|textarea|hotkey|drop/g)?.[0]
      .trim() ||
    UI.none) as UI

  if (ui) {
    ;(
      metadata as unknown as ScriptMetadata
    ).requiresPrompt = true
  }

  if (metadata?.log === "false") {
    ;(metadata as unknown as ScriptMetadata).log = "false"
  }

  return metadata as unknown as ScriptMetadata
}

export let parseMetadata = (
  fileContents: string
): ScriptMetadata => {
  let metadata: Metadata = getMetadata(fileContents)
  return formatScriptMetadata(metadata, fileContents)
}

export let commandFromFilePath = (filePath: string) =>
  path.basename(filePath)?.replace(/\.(j|t)s$/, "") || ""

export let kenvFromFilePath = (filePath: string) =>
  filePath.match(
    new RegExp(`(?<=${kenvPath("kenvs")}\/)[^\/]+`)
  )?.[0] || ""

export let iconFromKenv = async (kenv: string) => {
  let iconPath = kenv
    ? kenvPath("kenvs", kenv, "icon.png")
    : ""

  return kenv && (await isFile(iconPath)) ? iconPath : ""
}

export let parseFilePath = async (
  filePath: string
): Promise<ScriptPathInfo> => {
  let command = commandFromFilePath(filePath)
  let kenv = kenvFromFilePath(filePath)
  let icon = await iconFromKenv(kenv)

  return {
    id: filePath,
    command,
    filePath,
    kenv,
    icon,
  }
}

export let parseScript = async (
  filePath: string
): Promise<Script> => {
  let parsedFilePath = await parseFilePath(filePath)

  let contents = await readFile(filePath, "utf8")
  let metadata = parseMetadata(contents)

  return {
    name: metadata.menu || parsedFilePath.command,
    ...parsedFilePath,
    ...metadata,
  }
}

export let getLastSlashSeparated = (
  string: string,
  count: number
) => {
  return (
    string
      .replace(/\/$/, "")
      .split("/")
      .slice(-count)
      .join("/") || ""
  )
}

export let getScriptFiles = async (kenv = kenvPath()) => {
  let scriptsPath = path.join(kenv, "scripts")
  if (!(await isDir(scriptsPath))) {
    console.warn(`${scriptsPath} isn't a valid kenv dir`)
    return []
  }

  let result = await readdir(scriptsPath, {
    withFileTypes: true,
  })

  return result
    .filter(file => file.isFile())
    .map(file => file.name)
    .filter(name => name.match(/\.(mj|t|j)s$/))
    .map(file => path.join(scriptsPath, file))
}

export let getKenvs = async (): Promise<string[]> => {
  let kenvs: string[] = []
  if (!(await isDir(kenvPath("kenvs")))) return kenvs

  let dirs = await readdir(kenvPath("kenvs"), {
    withFileTypes: true,
  })

  return dirs
    .filter(d => d.isDirectory())
    .map(d => kenvPath("kenvs", d.name))
}

export let writeScriptsDb = async () => {
  let scriptFiles = await getScriptFiles()
  let kenvDirs = await getKenvs()
  for await (let kenvDir of kenvDirs) {
    let scripts = await getScriptFiles(kenvDir)
    scriptFiles = [...scriptFiles, ...scripts]
  }

  let scriptInfo = await Promise.all(
    scriptFiles.map(parseScript)
  )
  return scriptInfo.sort((a: Script, b: Script) => {
    let aName = a.name.toLowerCase()
    let bName = b.name.toLowerCase()

    return aName > bName ? 1 : aName < bName ? -1 : 0
  })
}

export let stripMetadata = (
  fileContents: string,
  exclude: string[] = []
) => {
  let negBehind = exclude.length
    ? `(?<!(${exclude.join("|")}))`
    : ``

  return fileContents.replace(
    new RegExp(`(^//([^:]*)${negBehind}:).*`, "gim"),
    "$1"
  )
}

export const getLogFromScriptPath = (filePath: string) => {
  return filePath
    .replace("scripts", "logs")
    .replace(/\.js$/, ".log")
}

export const resolveKenv = (...parts: string[]) => {
  if (global.kitScript) {
    return path.resolve(
      global.kitScript,
      "..",
      "..",
      ...parts
    )
  }

  return kenvPath(...parts)
}

export let selectScript = async (
  message: string | PromptConfig = "Select a script",
  fromCache = true,
  xf = x => x
): Promise<Script> => {
  let script: Script | string = await global.arg(
    message,
    xf(await getScripts(fromCache))
  )

  if (typeof script === "string") {
    return await getScriptFromString(script)
  }

  return script
}

//validator
export let exists = async (input: string) => {
  return (await isBin(kenvPath("bin", input)))
    ? global.chalk`{red.bold ${input}} already exists. Try again:`
    : (await isDir(kenvPath("bin", input)))
    ? global.chalk`{red.bold ${input}} exists as group. Enter different name:`
    : global.exec(`command -v ${input}`, {
        silent: true,
      }).stdout
    ? global.chalk`{red.bold ${input}} is a system command. Enter different name:`
    : !input.match(/^([a-z]|[0-9]|\-|\/)+$/g)
    ? global.chalk`{red.bold ${input}} can only include lowercase, numbers, and -. Enter different name:`
    : true
}

export let toggleBackground = async (script: Script) => {
  let { tasks } = await global.getBackgroundTasks()

  let task = tasks.find(
    task => task.filePath === script.filePath
  )

  let toggleOrLog: "toggle" | "log" | "edit" =
    await global.arg(
      `${script.command} is ${
        task ? `running` : `stopped`
      }`,
      [
        {
          name: `${task ? `Stop` : `Start`} ${
            script.command
          }`,
          value: `toggle`,
        },
        { name: `Edit ${script.command}`, value: `edit` },
        {
          name: `View ${script.command}.log`,
          value: `log`,
        },
      ]
    )

  if (toggleOrLog === "toggle") {
    global.send(Channel.TOGGLE_BACKGROUND, {
      filePath: script.filePath,
    })
  }

  if (toggleOrLog === "edit") {
    await global.edit(script.filePath, kenvPath())
  }

  if (toggleOrLog === "log") {
    await global.edit(
      kenvPath("logs", `${script.command}.log`),
      kenvPath()
    )
  }
}

export let createBinFromScript = async (
  type: Bin,
  { command, filePath }: Script
) => {
  let binTemplate = await readFile(
    kitPath("templates", "bin", "template"),
    "utf8"
  )

  let binTemplateCompiler = global.compile(binTemplate)
  let compiledBinTemplate = binTemplateCompiler({
    command,
    type,
    ...global.env,
    TARGET_PATH: filePath,
  })

  let binFilePath = path.join(
    filePath,
    "..",
    "..",
    "bin",
    command
  )

  global.mkdir("-p", path.dirname(binFilePath))
  await global.writeFile(binFilePath, compiledBinTemplate)
  global.chmod(755, binFilePath)
}

export let createBinFromName = async (
  command: string,
  kenv: string
) => {
  let binTemplate = await readFile(
    kitPath("templates", "bin", "template"),
    "utf8"
  )

  let binTemplateCompiler = global.compile(binTemplate)
  let compiledBinTemplate = binTemplateCompiler({
    command,
    type: Bin.scripts,
    ...global.env,
    TARGET_PATH: kenv,
  })

  let binFilePath = path.resolve(kenv, "bin", command)

  global.mkdir("-p", path.dirname(binFilePath))
  await global.writeFile(binFilePath, compiledBinTemplate)
  global.chmod(755, binFilePath)
}

export let trashBinFromScript = async (script: Script) => {
  global.trash([
    kenvPath(
      script.kenv && `kenvs/${script.kenv}`,
      "bin",
      script.command
    ),
  ])
}

type Kenv = {
  name: string
  dirPath: string
}
export let selectKenv = async (): Promise<Kenv> => {
  let homeKenv = {
    name: "home",
    description: `Your main kenv: ${kenvPath()}`,
    value: {
      name: "home",
      dirPath: kenvPath(),
    },
  }
  let selectedKenv: Kenv | string = homeKenv.value

  let kenvs = await getKenvs()
  if (kenvs.length) {
    let kenvChoices = [
      homeKenv,
      ...kenvs.map(p => {
        let name = getLastSlashSeparated(p, 1)
        return {
          name,
          description: p,
          value: {
            name,
            dirPath: p,
          },
        }
      }),
    ]

    selectedKenv = await global.arg(
      `Select target kenv`,
      kenvChoices
    )

    if (typeof selectedKenv === "string") {
      return kenvChoices.find(
        c =>
          c.value.name === selectedKenv ||
          path.resolve(c.value.dirPath) ===
            path.resolve(selectedKenv as string)
      ).value
    }
  }

  return selectedKenv as Kenv
}

export let kitMode = () =>
  (process.env.KIT_MODE || "js").toLowerCase()

export let run = async (
  command: string,
  ...commandArgs: string[]
) => {
  let [script, ...scriptArgs] = command.split(" ")
  let resolvedScript = resolveToScriptPath(script)
  global.onTabs = []
  global.kitScript = resolvedScript

  if (process.env.KIT_CONTEXT === "app") {
    let script = await parseScript(global.kitScript)

    global.send(Channel.SET_SCRIPT, {
      script,
    })
  }

  return await global.attemptImport(
    resolvedScript,
    ...scriptArgs,
    ...commandArgs
  )
}

export let configEnv = () => {
  let { parsed, error } = config({
    path: process.env.KIT_DOTENV_PATH || kenvPath(),
    silent: true,
  })

  process.env.PATH =
    (parsed?.PATH || process.env.PATH) +
    path.delimiter +
    KIT_FIRST_PATH

  assignPropsTo(process.env, global.env)

  return parsed
}
