import { existsSync } from "fs"

//Description: Adds the .kenv bin dir to your $PATH
export {}

let exportKitBinPath = `export PATH="$PATH:${kitPath(
  "bin"
)}"`

let choices = [
  `.zshrc`,
  `.bashrc`,
  `.bash_profile`,
  `.config/fish/config.fish`,
  `.profile`,
]

let profiles = choices
  .map(profile => `${env.HOME}/${profile}`)
  .filter(profile => existsSync(profile))

let selectedProfile = await arg(
  "Select your profile:",
  profiles
)

await appendFile(selectedProfile, `\n${exportKitBinPath}`)
let { stdout } = exec(`wc ${selectedProfile}`, {
  silent: true,
})
let lineCount = stdout.trim().split(" ").shift()

edit(selectedProfile, kenvPath(), lineCount)
