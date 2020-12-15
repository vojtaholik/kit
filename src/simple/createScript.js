let { createSourceFilePath, createBinFile } = await import(
  "./utils.js"
)

export let createScript = async (
  name,
  contents,
  need = []
) => {
  let template = await env("SIMPLE_TEMPLATE")
  let result = exec(`type ${name}`, { silent: true })
  if (result.stdout) {
    console.log(`${name} already exists. 
${result.stdout.trim()}
Please pick a different name:`)
    spawn("new", [], { stdio: "inherit" })
    return
  }

  let simpleTemplatePath = path.join(
    env.SIMPLE_PATH,
    "templates",
    template + ".js"
  )

  if (typeof contents == "undefined") {
    let simpleTemplate = await readFile(
      simpleTemplatePath,
      "utf8"
    )
    simpleTemplate = Handlebars.compile(simpleTemplate)
    simpleTemplate = simpleTemplate({
      ...env,
      name,
    })
    contents = simpleTemplate
  }
  let simpleFilePath = createSourceFilePath(name)

  contents =
    need
      .map(pkg => `let {} = await need("${pkg}")`)
      .join("\n") + contents

  await writeFile(simpleFilePath, contents)
  await createBinFile(name)

  let greenName = chalk.green.bold(name)
  let yellowTemplate = chalk.yellow(template)

  echo(
    `\n> Created a ${greenName} script using the ${yellowTemplate} template.`
  )

  let line = 1
  let col = 1

  if (need.length) col = 6

  edit(simpleFilePath, env.SIMPLE_PATH, line, col)
}
