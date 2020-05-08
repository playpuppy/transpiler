import { Parser, ParseTree } from "./puppy-pasm"
import { PuppyParser } from "./parser"
import { Stopify } from "./stopify"
import { Language, Module, Code } from "./modules"
import { Generator, Environment as Compiler } from "./generator"
import { OrigamiJS } from "./jscompiler"

export { Language, Module, Parser, Compiler, Code, ParseTree}

export class Origami {
  lang: Language
  gen: Generator
  parsers: Parser[] = []

  public constructor(lang: Language, generator?: Generator) {
    this.lang = lang
    this.gen = generator ? generator : new OrigamiJS()
    this.gen.setLanguage(this.lang)
  }

  public addParser(parser: Parser) {
    this.parsers.push(parser)
  }

  private parse(source: string) {
    const tree = PuppyParser(source)
    if (tree.isSyntaxError()) {
      for (const p of this.parsers) {
        const pt = p(source)
        if (!pt.isSyntaxError()) {
          return pt
        }
      }
    }
    return tree
  }

  public compile(source: string) {
    const tree = this.parse(source)
    return this.gen.generate(tree)
  }

}

class LibPuppy extends Module {

  constructor() {
    super([])
  }

  __init__(context: any) {
    context['$__world__'] = null
  }

  print(v: any[], options?: any) {
    console.log(v.map((x) => `${x}`).join(' '))
  }

}

const test = () => {
  const puppy = new Language(
    ['', new LibPuppy()]
  )
  const compiler = new Origami(puppy)
}
