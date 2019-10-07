import { generate, ParseTree } from './puppy3-parser';

const INDENT = '\t';

class Type {
  public isOptional: boolean;
  public constructor(isOptional: boolean) {
    this.isOptional = isOptional;
  }

  public toString() {
    return '?';
  }

  public rtype(): Type {
    return this;
  }
  public psize() {
    return 0;
  }
  public ptype(index: number): Type {
    return this;
  }

  public realType(): Type {
    return this;
  }

  public equals(ty: Type, update: boolean): boolean {
    return false;
  }

  public accept(ty: Type): boolean {
    return this.equals(ty, true);
  }

  public isPattern() {
    return false;
  }

  public toVarType(map: any): Type {
    return this;
  }

}

class BaseType extends Type {
  private name: string;

  constructor(name: string, isOptional?: any) {
    super(isOptional !== undefined);
    this.name = name;
  }

  public toString() {
    return this.name;
  }

  public equals(ty: Type, update: boolean): boolean {
    const v = ty.realType();
    if (v instanceof BaseType) {
      return this.name === v.name;
    }
    if (update && v instanceof VarType) {
      return v.must(this);
    }
    return false;
  }

  public isPattern() {
    return (this.name === 'a' || this.name === 'b');
  }

  public toVarType(map: any) {
    if (this.isPattern()) {
      const ty = map[this.name];
      if (ty === undefined) {
        map[this.name] = new VarType(map.env, map.t);
      }
      return map[this.name];
    }
    return this;
  }
}

class VoidType extends BaseType {

  constructor(isOptional?: any) {
    super('void', isOptional);
  }

  public accept(ty: Type): boolean {
    const v = ty.realType();
    if (v instanceof VarType) {
      v.must(this);
    }
    return true;
  }
}

class AnyType extends BaseType {

  constructor(isOptional?: any) {
    super('any', isOptional);
  }

  public accept(ty: Type): boolean {
    const v = ty.realType();
    if (v instanceof VoidType) {
      return false;
    }
    return true;
  }
}

class FuncType extends Type {
  private types: Type[];
  constructor(...types: Type[]) {
    super(false);
    this.types = types;
  }

  public toString() {
    const ss = ['(']
    for (var i = 1; i < this.types.length; i += 1) {
      if (i > 1) {
        ss.push(',');
      }
      ss.push(this.types[i].toString())
    }
    ss.push(')->')
    ss.push(this.types[0].toString());
    return ss.join('');
  }

  public rtype() {
    return this.types[0];
  }
  public psize() {
    return this.types.length - 1;
  }
  public ptype(index: number) {
    return this.types[index + 1];
  }

  public equals(ty: Type, update: boolean): boolean {
    const v = ty.realType();
    if (v instanceof FuncType && this.psize() == v.psize()) {
      for (var i = 0; i < this.types.length; i += 1) {
        if (!this.types[i].equals(v.types[i], update)) {
          return false;
        }
        return true;
      }
    }
    if (update && v instanceof VarType) {
      return v.must(this);
    }
    return false;
  }

  public isPattern() {
    for (const ty of this.types) {
      if (ty.isPattern()) return true;
    }
    return false;
  }

  public toVarType(map: any) {
    if (this.isPattern()) {
      const v = [];
      for (const ty of this.types) {
        v.push(ty.toVarType(map));
      }
      return new FuncType(...v);
    }
    return this;
  }
}

class ListType extends Type {
  private param: Type;
  constructor(param: Type, isOptional?: any) {
    super(isOptional !== undefined);
    this.param = param;
  }

  public toString() {
    return `List${this.param.toString()}`;
  }

  public psize() {
    return 1;
  }
  public ptype(index: number) {
    return this.param;
  }

  public realType(): Type {
    const p = this.param.realType();
    if (p !== this.param) {
      return new ListType(p);
    }
    return this;
  }

  public equals(ty: Type, update: boolean): boolean {
    const v = ty.realType();
    if (v instanceof ListType) {
      return this.param.equals(v.param, update);
    }
    if (v instanceof VarType) {
      return v.must(this);
    }
    return false;
  }
  public isPattern() {
    return this.param.isPattern();
  }

  public toVarType(map: any) {
    if (this.isPattern()) {
      return new ListType(this.param.toVarType(map));
    }
    return this;
  }

}

const tAny = new AnyType();
const tVoid = new VoidType();
const tBool = new BaseType('Bool');
const tInt = new BaseType('Number');
const tInt_ = new BaseType('Number', true);
const tFloat = tInt;
const tFloat_ = tInt_;
const tString = new BaseType('String');
const tString_ = new BaseType('String', true);
const tA = new BaseType('a');
const tListA = new ListType(tA);
const tListInt = new ListType(tInt);
const tUndefined = new BaseType('undefined');

class VarType extends Type {
  private varMap: Type[] = [];
  private varid: number;
  private ref: ParseTree | null;

  constructor(env: Env, ref: ParseTree) {
    super(false);
    this.varMap = env.getroot('@varmap');
    this.varid = this.varMap.length;
    this.varMap.push(tUndefined);
    this.ref = ref;
  }

  public toString() {
    const v = this.varMap[this.varid];
    if (v !== tUndefined) {
      return v.toString();
    }
    return 'any';
  }

  public setref(t: ParseTree) {
    this.ref = t;
  }

  public realType(): Type {
    const v = this.varMap[this.varid];
    return (v === tUndefined) ? this : v;
  }

  public equals(ty: Type, update: boolean): boolean {
    var v = this.varMap[this.varid];
    if (v !== tUndefined) {
      return v.equals(ty, update);
    }
    v = ty.realType();
    if (update) {
      this.varMap[this.varid] = v;
      return true;
    }
    return this === v;
  }

  public must(ty: Type): boolean {
    this.varMap[this.varid] = ty;
    return true;
  }
}

class OptionType extends Type {
  private options: any;
  constructor(options: any) {
    super(false);
    this.options = options;
  }

  public toString() {
    return '...';
  }

  public accept(ty: Type): boolean {
    const v = ty.realType();
    if (v instanceof OptionType) {
      return true;
    }
    return false;
  }

  public equals(ty: Type, update: boolean): boolean {
    return this.accept(ty);
  }

  public isPattern() {
    return false;
  }

  public toVarType(map: any) {
    return this;
  }
}

class UnionType extends Type {
  private types: Type[];
  constructor(...types: Type[]) {
    super(false);
    this.types = types;
  }

  public toString() {
    const ss = []
    for (var i = 0; i < this.types.length; i += 1) {
      if (i > 1) {
        ss.push('|');
      }
      ss.push(this.types[i].toString())
    }
    return ss.join('');
  }
  public psize() {
    return this.types.length;
  }
  public ptype(index: number) {
    return this.types[index];
  }

  public accept(ty: Type): boolean {
    const v = ty.realType();
    if (v instanceof VarType) {
      return true;
    }
    for (const t of this.types) {
      if (t.accept(v)) {
        return true;
      }
    }
    return false;
  }

  public equals(ty: Type, update: boolean): boolean {
    return false;
  }

  public isPattern() {
    return false;
  }

  public toVarType(map: any) {
    return this;
  }
}

const union = (...types: Type[]) => {
  if (types.length === 1) {
    return types[0];
  }
  return new UnionType(...types);
}

const typeMap: any = {
  'Int': tInt,
  'Float': tFloat,
  'String': tString,
};

const typeOf = (id: string) => {
  const ty: Type = typeMap[id];
  if (ty !== undefined) {
    return ty;
  }
  return tAny;
};

const T = (ty: Type) => {
  return ty;
}

const BINARY = {
  '+': {
    'left': [tInt, tString, tListA],
  },
  '*': {
    'left': [tInt, tString, tListA],
    'right': tInt,
  },
  '==': {
    'return': tBool,
  },
  '<': {
    'left': [tInt, tString],
    'return': tBool,
  },
}

class Symbol {
  public code: string;
  public ty: Type;
  public isMatter: boolean;
  public constructor(code: string, ty: Type) {
    this.code = code;
    this.ty = ty.realType();
    this.isMatter = false;
  }
  public isGlobal() {
    return this.code.indexOf('puppy.vars[') == 0;
  }
}

const tOption = new OptionType({});
const tFuncFloatFloat = new FuncType(tFloat, tFloat);
const tFuncFloatFloatFloat = new FuncType(tFloat, tFloat, tFloat);

const import_math = {
  'pi': new Symbol('3.14159', tFloat),
  'sin': new Symbol('Math.sin', tFuncFloatFloat),
  'cos': new Symbol('Math.cos', tFuncFloatFloat),
  'tan': new Symbol('Math.tan', tFuncFloatFloat),
  'sqrt': new Symbol('Math.sqrt', tFuncFloatFloat),
  'log': new Symbol('Math.log', tFuncFloatFloat),
  'log10': new Symbol('Math.log10', tFuncFloatFloat),

  'pow': new Symbol('Math.pow', tFuncFloatFloatFloat),
  'hypot': new Symbol('Math.hypot', tFuncFloatFloatFloat),
  'gcd': new Symbol('puppy.gcd', tFuncFloatFloatFloat),
}

const import_python = {
  // 'math.': IMPORT_MATH,
  // 'random.': IMPORT_RANDOM,
  'input': new Symbol('await puppy.input', new FuncType(tString, tString_)),
  'print': new Symbol('puppy.print', new FuncType(tVoid, tAny, tOption)),

  //# 返値, 引数..None はなんでもいい
  'len': new Symbol('puppy.len', new FuncType(tInt, union(tString, tListA))),
  //可変長引数
  'range': new Symbol('puppy.range', new FuncType(tListInt, tInt, tInt_, tInt_)),
  //append
  '.append': new Symbol('puppy.append', new FuncType(tVoid, tListA, tA)),

  // 変換
  'int': new Symbol('puppy.int', new FuncType(tInt, union(tBool, tString, tInt))),
  'float': new Symbol('puppy.float', new FuncType(tFloat, union(tBool, tString, tInt))),
  'str': new Symbol('puppy.str', new FuncType(tString, tAny)),
  'random': new Symbol('Math.random', new FuncType(tInt)),

  // # 物体メソッド
  // '.setPosition': Symbol('puppy.setPosition', const, (tVoid, ts.Matter, tInt, tInt)),
  // '.applyForce': Symbol('puppy.applyForce', const, (tVoid, ts.Matter, tInt, tInt, tInt, tInt)),
  // '.rotate': Symbol('puppy.rotate', const, (tVoid, ts.Matter, tInt, tInt_, tInt_)),
  // '.scale': Symbol('puppy.scale', const, (tVoid, ts.Matter, tInt, tInt, tInt_, tInt_)),
  // '.setAngle': Symbol('puppy.setAngle', const, (tVoid, ts.Matter, tInt)),
  // '.setAngularVelocity': Symbol('puppy.setAngularVelocity', const, (tVoid, ts.Matter, tInt)),
  // '.setDensity': Symbol('puppy.setDensity', const, (tVoid, ts.Matter, tInt)),
  // '.setMass': Symbol('puppy.setMass', const, (tVoid, ts.Matter, tInt)),
  // '.setStatic': Symbol('puppy.setStatic', const, (tVoid, ts.Matter, tBool)),
  // '.setVelocity': Symbol('puppy.setVelocity', const, (tVoid, ts.Matter, tInt)),

  // # クラス
  // 'World': Symbol('world', const, ts.MatterTypes),
  // 'Circle': Symbol('Circle', const, ts.MatterTypes),
  // 'Rectangle': Symbol('Rectangle', const, ts.MatterTypes),
  // 'Polygon': Symbol('Polygon', const, ts.MatterTypes),
  // 'Label': Symbol('Label', const, ts.MatterTypes),
  // 'Drop': Symbol('Drop', const, ts.MatterTypes),
  // 'Newton': Symbol('Pendulum', const, ts.MatterTypes),
  // 'Ball': Symbol('Circle', const, (ts.Matter, tInt, tInt, { 'restitution': 1.0 })),
  // 'Block': Symbol('Rectangle', const, (ts.Matter, tInt, tInt, { 'isStatic': 'true' })),
};

const tColor = union(tString, tInt);
const tVec = new BaseType('Vec');
const tMatter = new BaseType('Object');

const KEYTYPES = {
  'width': tInt, 'height': tInt,
  'x': tInt, 'y': tInt,
  'image': tString,
  'strokeStyle': tColor,
  'lineWidth': tInt,
  'fillStyle': tColor,
  'restitution': tFloat,
  'angle': tFloat,
  'position': tVec,
  'mass': tInt, 'density': tInt, 'area': tInt,
  'friction': tFloat, 'frictionStatic': tFloat, 'airFriction': tFloat,
  'torque': tFloat, 'stiffness': tFloat,
  'isSensor': tBool,
  'isStatic': tBool,
  'damping': tFloat,
  'in': new FuncType(tVoid, tMatter, tMatter),
  'out': new FuncType(tVoid, tMatter, tMatter),
  'over': new FuncType(tVoid, tMatter, tMatter),
  'clicked': new FuncType(tVoid, tMatter),
  'font': tString,
  'fontColor': tColor,
  'textAlign': tString,
  'value': tInt,
  'message': tString,
}

type ErrorLog = {
  type: string;
  key: string;
  pos?: number;
  row?: number;
  column?: number;
  len?: number;
  subject?: string;
  request?: Type;
  given?: Type;
};

const setpos = (s: string, pos: number, elog: ErrorLog) => {
  const max = Math.min(pos + 1, s.length);
  var r = 1;
  var c = 0;
  for (var i = 0; i < max; i += 1) {
    if (s.charCodeAt(i) == 10) {
      r += 1;
      c = 0;
    }
    c += 1;
  }
  elog.pos = pos;
  elog.row = r;
  elog.column = c;
  return elog;
}

class Env {
  private root: Env;
  private parent: Env | null;
  private vars: any;

  public constructor(env?: Env) {
    this.vars = {}
    if (env === undefined) {
      this.root = this;
      this.parent = null;
      this.vars['@varmap'] = []
    }
    else {
      this.root = env.root;
      this.parent = env;
    }
  }

  public get(key: string, value?: any) {
    var e: Env | null = this;
    while (e !== null) {
      const v = e.vars[key];
      if (v !== undefined) {
        return v;
      }
      e = e.parent;
    }
    return value;
  }

  public has(key: string) {
    return this.get(key) !== undefined;
  }

  public set(key: string, value: any) {
    this.vars[key] = value;
    return value;
  }

  public getroot(key: string, value?: any) {
    return this.root.vars[key] || value;
  }

  public setroot(key: string, value: any) {
    this.root.vars[key] = value;
    return value;
  }

  public perror(t: ParseTree, elog: ErrorLog) {
    const logs = this.root.vars['@@logs'];
    if (elog.pos === undefined) {
      elog = setpos(t.inputs, t.spos, elog);
    }
    if (elog.len === undefined) {
      elog.len = t.epos - t.spos;
    }
    logs.push(elog);
  }

  // public perror(t: ParseTree, elog: ErrorLog) {
  //   this.log2(t, elog);
  // }
  // public pwarn(t: ParseTree, msg: string) {
  //   this.plog('warning', t, msg);
  // }

  // public pinfo(t: ParseTree, msg: string) {
  //   this.plog('info', t, msg);
  // }

  public setInLoop() {
    this.set('@inloop', true);
    return true;
  }

  public inLoop() {
    return this.get('@inloop') === true;
  }

  public setFunc(data: any) {
    this.set('@func', data)
    return data;
  }

  public inFunc() {
    return this.get('@func') !== undefined;
  }


  public declVar(name: string, ty: Type) {
    var code = `puppy.vars['${name}']`
    if (this.inFunc()) {
      code = name;
      return this.set(name, new Symbol(code, ty)) as Symbol;
    }
    return this.set(name, new Symbol(code, ty)) as Symbol;
  }

  public emitAutoYield(out: string[]) {
    const yieldparam = this.getroot('@yeild');
    if (yieldparam !== undefined && !this.inFunc()) {
      out.push(`; yield ${yieldparam};\n`)
      this.setroot('@yeild', undefined);
    }
    else {
      out.push('\n')
    }
  }
}

class TypeError {
  public constructor() {
  }
}

class Transpiler {

  public constructor() {
  }

  public conv(env: Env, t: ParseTree, out: string[]) {
    console.log(t.toString());
    try {
      return (this as any)[t.tag](env, t, out);
    }
    catch (e) {
      console.log(e);
      env.perror(t, {
        type: 'error',
        key: 'UndefinedParseTree',
        subject: t.toString(),
      })
      return this.skip(env, t, out);
    }
  }

  public skip(env: Env, t: ParseTree, out: string[]) {
    throw new TypeError();
    // out.push('undefined');
    // return tAny;
  }

  public check(req: Type, env: Env, t: ParseTree, out: string[], elog?: ErrorLog) {
    const ty = this.conv(env, t, out);
    if (req.accept(ty)) {
      return ty;
    }
    if (elog === undefined) {
      elog = {
        type: 'error',
        key: 'TypeError',
      }
    }
    elog.request = req;
    elog.given = ty;
    env.perror(t, elog);
    return this.skip(env, t, out);
  }

  public Source(env: Env, t: ParseTree, out: string[]) {
    for (const subtree of t.subs()) {
      try {
        const out2: string[] = [];
        out2.push(env.get('@indent'))
        this.conv(env, subtree, out2);
        env.emitAutoYield(out2);
        out.push(out2.join(''))
      }
      catch (e) {
        console.log(e);
      }
    }
    return tVoid;
  }

  public Block(penv: Env, t: ParseTree, out: string[]) {
    const indent = penv.get('@indent')
    const nested = INDENT + indent
    const env = new Env(penv)
    env.set('@indent', nested)
    out.push('{\n')
    for (const subtree of t.subs()) {
      out.push(env.get('@indent'))
      this.conv(env, subtree, out);
      env.emitAutoYield(out);
    }
    out.push(indent + '}\n')
    return tVoid;
  }

  public IfStmt(env: Env, t: any, out: string[]) {
    out.push('if (');
    this.check(tBool, env, t['cond'], out);
    out.push(') ');
    this.conv(env, t['then'], out);
    if (t['else'] !== undefined) {
      out.push('else ');
      this.conv(env, t['else'], out);
    }
    return tVoid;
  }

  public ForStmt(env: Env, t: any, out: string[]) {
    if (t['each'].tag !== 'Name') {
      env.perror(t['each'], {
        type: 'error', key: 'RequiredIdentifier',
      });
      return tVoid;
    }
    const name = t['each'].tokenize();
    const ty = new VarType(env, t['each']);
    out.push(`for (let ${name} of `)
    this.check(new ListType(ty), env, t['list'], out)
    out.push(')')
    const lenv = new Env(env);
    lenv.declVar(name, ty);
    lenv.setInLoop();
    this.conv(lenv, t['body'], out)
    return tVoid
  }

  public FuncDecl(env: Env, t: any, out: string[]) {
    const name = t.tokenize('name');
    const types = [new VarType(env, t['name'])];
    const names = [];
    const lenv = new Env(env);
    const funcData = lenv.setFunc({
      'name': name,
      'return': types[0],
      'hasReturn': false,
    });
    for (const p of t['params']) {
      const pname = p.tokenize('name');
      const ptype = new VarType(env, p['name']);
      const symbol = lenv.declVar(pname, ptype);
      names.push(symbol.code)
      types.push(ptype)
    }
    const funcType = new FuncType(...types);
    const symbol = env.declVar(name, funcType);
    const defun = symbol.isGlobal() ? '' : 'var ';
    out.push(`${defun} ${name}(${names.join(', ')}) => `)
    this.conv(lenv, t['body'], out);
    if (!funcData['hasReturn']) {
      types[0].accept(tVoid);
    }
    return tVoid;
  }

  public FuncExpr(env: Env, t: any, out: string[]) {
    const types = [new VarType(env, t)];
    const names = [];
    const lenv = new Env(env);
    const funcData = lenv.setFunc({
      'return': types[0],
      'hasReturn': false,
    });
    for (const p of t['params']) {
      const pname = p.tokenize('name');
      const ptype = new VarType(env, p['name']);
      const symbol = lenv.declVar(pname, ptype);
      names.push(symbol.code)
      types.push(ptype)
    }
    const funcType = new FuncType(...types);
    out.push(`(${names.join(', ')}) => `)
    this.conv(lenv, t['body'], out);
    if (!funcData['hasReturn']) {
      types[0].accept(tVoid);
    }
    return funcType;
  }

  public Return(env: Env, t: any, out: string[]) {
    if (!env.inFunc()) {
      env.perror(t, {
        type: 'warning',
        key: 'OnlyInFunction',
        subject: 'return',
      });
      return tVoid;
    }
    const funcData = env.get('@func');
    funcData['hasReturn'] = true;
    if (t.has('expr')) {
      out.push('return ');
      this.check(funcData['return'], env, t['expr'], out);
    }
    else {
      out.push('return');
    }
    return tVoid;
  }

  public Continue(env: Env, t: any, out: string[]) {
    if (!env.inLoop()) {
      env.perror(t, {
        type: 'warning',
        key: 'OnlyInLoop',
        subject: 'continue',
      });
      return tVoid;
    }
    out.push('continue');
    return tVoid;
  }

  public Break(env: Env, t: any, out: string[]) {
    if (!env.inLoop()) {
      env.perror(t, {
        type: 'warning',
        key: 'OnlyInLoop',
        subject: 'break',
      });
      return tVoid;
    }
    out.push('break');
    return tVoid;
  }

  public Pass(env: Env, t: any, out: string[]) {
    return tVoid;
  }


  public VarDecl(env: Env, t: any, out: string[]) {
    const left = t['left'] as ParseTree;
    if (left.tag === 'Name') {
      const name = left.tokenize();
      var symbol = env.get(name) as Symbol;
      if (symbol === undefined) {
        const ty = new VarType(env, left);
        symbol = env.declVar(name, ty);
        if (symbol.isGlobal()) {
          out.push(`${symbol.code} = `);
        }
        else {
          out.push(`var ${symbol.code} = `);
        }
        this.check(ty, env, t['right'], out)
        return tVoid;
      }
    }
    const ty = this.conv(env, t['left'], out);
    out.push(' = ');
    this.check(ty, env, t['right'], out)
    return tVoid;
  }

  public Name(env: Env, t: any, out: string[]) {
    const name = t.tokenize();
    const symbol = env.get(name) as Symbol;
    if (symbol === undefined) {
      env.perror(t, {
        type: 'error',
        key: 'UndefinedName',
        subject: name,
      });
      return this.skip(env, t, out);
    }
    out.push(symbol.code);
    return symbol.ty;
  }

  public Infix(env: Env, t: any, out: string[]) {
    const op = (t.tokenize('op'));
    this.conv(env, t['left'], out);
    out.push(` ${op} `);
    this.conv(env, t['right'], out);
    return tAny; // FIXME
    // const op = binary(t.tokenize('op'));
    // const symbol = env.get(name) as Symbol;
    // if (symbol === undefined) {
    //   return tAny;
    // }
    // out.push(symbol.code);
    // return symbol.ty;
  }

  public ApplyExpr(env: Env, t: any, out: string[]) {
    const name = t.tokenize('name');
    const symbol = env.get(name) as Symbol;
    if (symbol === undefined) {
      env.perror(t['name'], {
        type: 'error',
        key: 'UnknownName',
        subject: name,
      });
      return this.skip(env, t, out);
    }
    out.push(symbol.code)
    out.push('(')
    const args = t['params'].subs();
    const funcType = symbol.ty;
    for (var i = 0; i < args.length; i += 1) {
      if (!(i < funcType.psize())) {
        env.perror(args[i], {
          type: 'warning',
          key: 'TooManyArguments',
          subject: args[i],
        });
        break;
      }
      if (i > 0) {
        out.push(',');
      }
      const ty = funcType.ptype(i);
      this.check(ty, env, args[i], out);
    }
    if (args.length < funcType.psize()) {
      if (!funcType.ptype(args.length)) {
        env.perror(t['name'], setpos(t.inputs, t['params'].epos, {
          type: 'error',
          key: 'RequiredArguments',
        }));
      }
    }
    out.push(')');
    // if name == 'puppy.print':
    //   env['@@yield'] = trace(env, t);
    return funcType.rtype();
  }


  /******

def emitArguments(env, t, args, types, prev, out):
    tidx = 1
    kargs = None
    options = None
    types = ts.unique(types)
    while tidx < len(types):
        if ts.isOption(types[tidx]):
            kargs = args[tidx:]
            options = types[tidx]
            break
        if tidx < len(args):
            out.push(prev)
            this.check(types[tidx], env, args[tidx], out)
            tidx += 1
            prev = ','
        else:
            if not ts.isOmittable(types[tidx]):
                perror(env, t, f'必要な引数が足りません')
            out.push(')')
            return
    if kargs != None:
        out.push(prev)
        out.push('{')
        used_keys = {}
        for sub in kargs:
            if sub.tag == 'KeywordArgument':
                KeywordArgument(env, sub, out, used_keys)
            elif sub.tag == 'NLPSymbol':
                NLPSymbol(env, sub, out, used_keys)
            else:
                pwarn(env, sub, 'この引数は使われません')
        for k in types[tidx]:
            if k not in used_keys:
                emitOption(env, t, k, options[k], out, used_keys)
        out.push(f"'trace': {trace(env, t)},")
        out.push(f"'oid': {env['@@oid']},")
        out.push('}')
    out.push(')')

  def Infix(env: Env, t, out):
    op = str(t['name'])
    if op in OPS:
        op = OPS[op]
    else:
        perror(env, t['name'], f'{op}？ 未対応の演算子です。')
        return emitUndefined(env, t['name'], out)
    out1 = []
    out2 = []
    ty1 = this.check(ts.binaryFirst(op), env, t['left'], out1)
    ty2 = this.check(ts.binarySecond(op, ty1), env, t['right'], out2)
    left,  right = ''.join(out1), ''.join(out2)
    ty = ts.typeBinary(env, t['op'], op, ty1, ty2, perror)
    key = ts.typeKey(ty1, op)
    if key in OPSFMT:
        out.push(OPSFMT[key].format(left, right))
    else:
        out.push(OPSFMT[op].format(left, right))
    return ty

def Return(env: Env, t, out):
    if '@local' not in env:
        pwarn(env, t, 'ここで return文は使えません')
        return tVoid
    out.push('return')
    ret = env['@local']
    if 'expr' in t:
        if ret == tVoid:
            pwarn(env, t['expr'], 'この返値は無視されます')
            return tVoid
        out.push(' ')
        this.check(ret, env, t['expr'], out, f'{ts.msg(ret)}を返すようにしてください')
        return tVoid
    if not ts.matchType(tVoid, ret):
        perror(env, t, f'{ts.msg(ret)}を返すようにしてください')
    return tVoid
        
  ******/

  public MethodExpr(env: Env, t: any, out: string[]) {
    const name = `.${t.tokenize('name')}`;
    const symbol = env.get(name);
    if (symbol === undefined) {
      env.perror(t['name'], {
        type: 'error',
        key: 'UnknownName',
        subject: name,
      });
      return this.skip(env, t, out);
    }
    const funcType = symbol.ty;
    out.push(symbol.name);
    const args = t['params'].subs();
    args.unshift(t['recv']);
    out.push('(')
    for (var i = 0; i < args.length; i += 1) {
      if (!(i < funcType.psize())) {
        //env.pwarn(args, '冗長なパラメータです');
        break;
      }
      if (i > 0) {
        out.push(',');
      }
      const ty = funcType.ptype(i);
      this.check(ty, env, args[i], out);
    }
    out.push(')');
    return funcType.rtype();
  }

  public GetExpr(env: Env, t: any, out: string[]) {
    const name = t.tokenize('name');
    // const pkgname = t.tokenize('recv');
    // const pkg = env.get(pkgname);
    // if (pkg !== undefined && !(pkg instanceof Symbol)) {
    //   pkg[name];
    // }
    this.check(tMatter, env, t['recv'], out);
    out.push('.');
    const ty = (KEYTYPES as any)[name] || new VarType(env, t['name']);
    if (ty instanceof UnionType) {
      return ty.ptype(0);
    }
    return ty;
  }

  public Index(env: Env, t: any, out: string[]) {
    const ty = this.check(union(new ListType(new VarType(env, t)), tString), env, t['recv'], out)
    out.push('[')
    this.check(tInt, env, t['index'], out)
    out.push(']')
    if (ty instanceof ListType) {
      return ty.ptype(0);
    }
    return ty;
  }

  public Data(env: Env, t: ParseTree, out: string[]) {
    out.push('{');
    for (const sub of t.subs()) {
      this.conv(env, sub, out);
      out.push(',');
    }
    out.push('}');
    return tOption;
  }

  public KeyValue(env: Env, t: any, out: string[]) {
    const name = t.tokenize('name');
    out.push(`'${name}': `)
    const ty = (KEYTYPES as any)[name];
    if (ty === undefined) {
      env.perror(t['name'], {
        type: 'warning',
        key: 'UnknownName',
        subject: name,
      });
      this.conv(env, t['value'], out)
    }
    else {
      this.check(ty, env, t['value'], out);
    }
    return tVoid
  }

  public Tuple(env: Env, t: ParseTree, out: string[]) {
    const subs = t.subs()
    if (subs.length > 2) {
      env.perror(t, {
        type: 'warning',
        key: 'ListSyntaxError', //リストは[ ]で囲みましょう
      });
      return this.List(env, t, out);
    }
    if (subs.length == 1) {
      out.push('(')
      const ty = this.conv(env, subs[0], out)
      out.push(')')
      return ty;
    }
    out.push('{ x: ')
    this.check(tInt, env, subs[0], out);
    out.push(', y: ')
    this.check(tInt, env, subs[1], out);
    out.push('}')
    return tVec;
  }

  public List(env: Env, t: ParseTree, out: string[]) {
    var ty = new VarType(env, t);
    out.push('[')
    for (const sub of t.subs()) {
      ty = this.check(ty, env, sub, out, {
        type: 'error',
        key: 'AllTypeAsSame' //全ての要素を同じ型に揃えてください
      });
      out.push(',')
    }
    out.push(']')
    return new ListType(ty);
  }

  public TrueExpr(env: Env, t: ParseTree, out: string[]) {
    out.push('true');
    return tBool;
  }

  public FalseExpr(env: Env, t: ParseTree, out: string[]) {
    out.push('false');
    return tBool;
  }

  public Int(env: Env, t: ParseTree, out: string[]) {
    out.push(t.tokenize());
    return tInt;
  }

  public Float(env: Env, t: ParseTree, out: string[]) {
    out.push(t.tokenize());
    return tFloat;
  }

  public Double(env: Env, t: ParseTree, out: string[]) {
    out.push(t.tokenize());
    return tFloat;
  }

  public String(env: Env, t: ParseTree, out: string[]) {
    out.push(t.tokenize());  // FIXME
    return tString;
  }

  public Char(env: Env, t: ParseTree, out: string[]) {
    out.push(t.tokenize());  // FIXME
    return tString;
  }

}

const parser = generate('Source');

const transpile = (s: string, errors?: []) => {
  const t = parser(s);
  const env = new Env();
  const ts = new Transpiler();
  const out: string[] = [];
  ts.conv(env, t, out);
  return out.join('')
}

console.log(transpile('x=1\nx'));
