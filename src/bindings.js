/*******************************************************************************
 * Copyright (c) 2013 Max Schaefer.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Max Schaefer - initial API and implementation
 *******************************************************************************/

/* Name bindings for lexical variables. */
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function (require, exports) {
    var astutil = require('./astutil'),
        symtab = require('./symtab');

    function addBindings(ast) {
        var global_scope = new symtab.Symtab();
        global_scope.global = true;
        var scope = global_scope;
        var decl_scope = scope;
        astutil.visit(ast,
            function enter(nd, visit) {
                switch (nd.type) {
                    case 'FunctionDeclaration':
                        /* This check is needed for:
                                export function () { ... }
                           as it will not have an id but will be
                           a FunctionDeclaration in ES6 */
                        if (nd.id) {
                          decl_scope.set(nd.id.name, nd.id);
                          visit(nd.id);
                        }
                    // FALL THROUGH
                    case 'FunctionExpression':
                    case 'ArrowFunctionExpression':
                        var old_decl_scope = decl_scope;
                        scope = decl_scope = new symtab.Symtab(scope);
                        scope.global = false;

                        nd.attr.scope = scope;
                        if (( nd.type === 'FunctionExpression' ||
                              nd.type === 'ArrowFunctionExpression' ) && nd.id) {
                            decl_scope.set(nd.id.name, nd.id);
                            visit(nd.id);
                        }
                        decl_scope.set('this', { type: 'Identifier',
                            name: 'this',
                            loc: nd.loc,
                            range: nd.range,
                            attr: { enclosingFile: nd.attr.enclosingFile,
                                scope: decl_scope } });
                        for (var i = 0; i < nd.params.length; ++i) {
                            decl_scope.set(nd.params[i].name, nd.params[i]);
                            visit(nd.params[i]);
                        }

                        visit(nd.body);

                        // restore previous scope
                        if (!decl_scope.hasOwn('arguments'))
                            decl_scope.set('arguments', { type: 'Identifier',
                                name: 'arguments',
                                loc: nd.loc,
                                range: nd.range,
                                attr: { enclosingFile: nd.attr.enclosingFile,
                                    scope: decl_scope } });
                        scope = scope.outer;
                        decl_scope = old_decl_scope;

                        return false;

                    case 'CatchClause':
                        scope = new symtab.Symtab(scope);
                        scope.global = false;
                        scope.set(nd.param.name, nd.param);

                        visit(nd.param);
                        visit(nd.body);

                        scope = scope.outer;
                        return false;

                    case 'Identifier':
                    case 'ThisExpression':
                        nd.attr.scope = decl_scope;
                        break;

                    case 'MemberExpression':
                        visit(nd.object);
                        if (nd.computed)
                            visit(nd.property);
                        return false;

                    case 'VariableDeclarator':
                        if (nd.id.type === 'Identifier' && !decl_scope.hasOwn(nd.id.name))
                            decl_scope.set(nd.id.name, nd.id);

                        if (nd.id.type === 'ObjectPattern') {
                            obj = nd.id;
                            for (var i = 0; i < obj.properties.length; i++) {
                                prop = obj.properties[i];
                                decl_scope.set(prop.value.name, prop.value)
                                if (prop.value.type !== 'Identifier')
                                    console.log('THIS IS BAD CHECK VariableDeclarator CASE IN bindings.js')
                            }
                        }
                        if (nd.id.type === 'ArrayPattern') {
                            /* Case also needs to be handled */
                        }
                        break;

                    case 'Property':
                        // don't visit nd.key
                        visit(nd.value);
                        return false;
                }
            });
    }

    exports.addBindings = addBindings;
    return exports;
});
