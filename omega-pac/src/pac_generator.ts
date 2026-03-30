// eslint-disable-next-line @typescript-eslint/no-require-imports
const U2 = require('uglify-js') as any;
import Profiles from './profiles';

const PacGenerator = {
  ascii(str: string): string {
    return str.replace(/[\u0080-\uffff]/g, (char) => {
      return '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
    });
  },

  compress(ast: any): any {
    ast.figure_out_scope();
    const compressor = U2.Compressor({ warnings: false, keep_fargs: true, if_return: false });
    const compressed_ast = ast.transform(compressor);
    compressed_ast.figure_out_scope();
    compressed_ast.compute_char_frequency();
    compressed_ast.mangle_names();
    return compressed_ast;
  },

  script(options: any, profile: any, args?: any): any {
    if (typeof profile === 'string') {
      profile = Profiles.byName(profile, options);
    }
    const refs = Profiles.allReferenceSet(profile, options, {
      profileNotFound: args?.profileNotFound,
    });

    const profiles = new U2.AST_Object({
      properties: Object.entries(refs)
        .filter(([key]) => key !== '+direct')
        .map(([key, name]) => {
          let p: any;
          if (typeof profile === 'object' && profile.name === name) {
            p = profile;
          } else {
            p = Profiles.byName(name as string, options);
          }
          if (p == null) {
            p = Profiles.profileNotFound(name as string, args?.profileNotFound);
          }
          return new U2.AST_ObjectKeyVal({ key, value: Profiles.compile(p) });
        }),
    });

    const factory = new U2.AST_Function({
      argnames: [
        new U2.AST_SymbolFunarg({ name: 'init' }),
        new U2.AST_SymbolFunarg({ name: 'profiles' }),
      ],
      body: [
        new U2.AST_Return({
          value: new U2.AST_Function({
            argnames: [
              new U2.AST_SymbolFunarg({ name: 'url' }),
              new U2.AST_SymbolFunarg({ name: 'host' }),
            ],
            body: [
              new U2.AST_Directive({ value: 'use strict' }),
              new U2.AST_Var({
                definitions: [
                  new U2.AST_VarDef({
                    name: new U2.AST_SymbolVar({ name: 'result' }),
                    value: new U2.AST_SymbolRef({ name: 'init' }),
                  }),
                  new U2.AST_VarDef({
                    name: new U2.AST_SymbolVar({ name: 'scheme' }),
                    value: new U2.AST_Call({
                      expression: new U2.AST_Dot({
                        expression: new U2.AST_SymbolRef({ name: 'url' }),
                        property: 'substr',
                      }),
                      args: [
                        new U2.AST_Number({ value: 0 }),
                        new U2.AST_Call({
                          expression: new U2.AST_Dot({
                            expression: new U2.AST_SymbolRef({ name: 'url' }),
                            property: 'indexOf',
                          }),
                          args: [new U2.AST_String({ value: ':' })],
                        }),
                      ],
                    }),
                  }),
                ],
              }),
              new U2.AST_Do({
                body: new U2.AST_BlockStatement({
                  body: [
                    new U2.AST_If({
                      condition: new U2.AST_UnaryPrefix({
                        operator: '!',
                        expression: new U2.AST_Sub({
                          expression: new U2.AST_SymbolRef({ name: 'profiles' }),
                          property: new U2.AST_SymbolRef({ name: 'result' }),
                        }),
                      }),
                      body: new U2.AST_Return({
                        value: new U2.AST_SymbolRef({ name: 'result' }),
                      }),
                    }),
                    new U2.AST_SimpleStatement({
                      body: new U2.AST_Assign({
                        left: new U2.AST_SymbolRef({ name: 'result' }),
                        operator: '=',
                        right: new U2.AST_Sub({
                          expression: new U2.AST_SymbolRef({ name: 'profiles' }),
                          property: new U2.AST_SymbolRef({ name: 'result' }),
                        }),
                      }),
                    }),
                    new U2.AST_If({
                      condition: new U2.AST_Binary({
                        left: new U2.AST_UnaryPrefix({
                          operator: 'typeof',
                          expression: new U2.AST_SymbolRef({ name: 'result' }),
                        }),
                        operator: '===',
                        right: new U2.AST_String({ value: 'function' }),
                      }),
                      body: new U2.AST_SimpleStatement({
                        body: new U2.AST_Assign({
                          left: new U2.AST_SymbolRef({ name: 'result' }),
                          operator: '=',
                          right: new U2.AST_Call({
                            expression: new U2.AST_SymbolRef({ name: 'result' }),
                            args: [
                              new U2.AST_SymbolRef({ name: 'url' }),
                              new U2.AST_SymbolRef({ name: 'host' }),
                              new U2.AST_SymbolRef({ name: 'scheme' }),
                            ],
                          }),
                        }),
                      }),
                    }),
                  ],
                }),
                condition: new U2.AST_Binary({
                  left: new U2.AST_Binary({
                    left: new U2.AST_UnaryPrefix({
                      operator: 'typeof',
                      expression: new U2.AST_SymbolRef({ name: 'result' }),
                    }),
                    operator: '!==',
                    right: new U2.AST_String({ value: 'string' }),
                  }),
                  operator: '||',
                  right: new U2.AST_Binary({
                    left: new U2.AST_Call({
                      expression: new U2.AST_Dot({
                        expression: new U2.AST_SymbolRef({ name: 'result' }),
                        property: 'charCodeAt',
                      }),
                      args: [new U2.AST_Number({ value: 0 })],
                    }),
                    operator: '===',
                    right: new U2.AST_Number({ value: '+'.charCodeAt(0) }),
                  }),
                }),
              }),
              new U2.AST_Return({ value: new U2.AST_SymbolRef({ name: 'result' }) }),
            ],
          }),
        }),
      ],
    });

    return new U2.AST_Toplevel({
      body: [
        new U2.AST_Var({
          definitions: [
            new U2.AST_VarDef({
              name: new U2.AST_SymbolVar({ name: 'FindProxyForURL' }),
              value: new U2.AST_Call({
                expression: factory,
                args: [Profiles.profileResult(profile.name), profiles],
              }),
            }),
          ],
        }),
      ],
    });
  },
};

export default PacGenerator;
