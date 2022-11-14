"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertIDL = void 0;
var ts = require("typescript");
var bufferSourceTypes = [
    'ArrayBuffer',
    'ArrayBufferView',
    'DataView',
    'Int8Array',
    'Uint8Array',
    'Int16Array',
    'Uint16Array',
    'Uint8ClampedArray',
    'Int32Array',
    'Uint32Array',
    'Float32Array',
    'Float64Array',
];
var integerTypes = ['byte', 'octet', 'short', 'unsigned short', 'long', 'unsigned long', 'long long', 'unsigned long long'];
var stringTypes = ['ByteString', 'DOMString', 'USVString', 'CSSOMString'];
var floatTypes = ['float', 'unrestricted float', 'double', 'unrestricted double'];
var sameTypes = ['any', 'boolean', 'Date', 'Function', 'Promise', 'void'];
var baseTypeConversionMap = new Map(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], __spreadArray([], bufferSourceTypes, true).map(function (type) { return [type, type]; }), true), __spreadArray([], integerTypes, true).map(function (type) { return [type, 'number']; }), true), __spreadArray([], floatTypes, true).map(function (type) { return [type, 'number']; }), true), __spreadArray([], stringTypes, true).map(function (type) { return [type, 'string']; }), true), __spreadArray([], sameTypes, true).map(function (type) { return [type, type]; }), true), [
    ['object', 'any'],
    ['sequence', 'Array'],
    ['record', 'Record'],
    ['FrozenArray', 'ReadonlyArray'],
    ['EventHandler', 'EventHandler'],
    ['VoidPtr', 'unknown'],
], false));
function convertIDL(rootTypes, options) {
    var _a;
    var nodes = [];
    for (var _i = 0, rootTypes_1 = rootTypes; _i < rootTypes_1.length; _i++) {
        var rootType = rootTypes_1[_i];
        switch (rootType.type) {
            case 'interface':
            case 'interface mixin':
            case 'dictionary':
                nodes.push(convertInterface(rootType, options));
                for (var _b = 0, _c = rootType.extAttrs; _b < _c.length; _b++) {
                    var attr = _c[_b];
                    if (attr.name === 'Exposed' && ((_a = attr.rhs) === null || _a === void 0 ? void 0 : _a.value) === 'Window') {
                        nodes.push(ts.factory.createVariableStatement([ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword)], ts.factory.createVariableDeclarationList([
                            ts.factory.createVariableDeclaration(ts.factory.createIdentifier(rootType.name), undefined, ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(rootType.name), undefined)),
                        ], undefined)));
                    }
                }
                break;
            case 'includes':
                nodes.push(convertInterfaceIncludes(rootType));
                break;
            case 'enum':
                nodes.push(convertEnum(rootType));
                break;
            case 'callback':
                nodes.push(convertCallback(rootType));
                break;
            case 'typedef':
                nodes.push(convertTypedef(rootType));
                break;
            default:
                console.log(newUnsupportedError('Unsupported IDL type', rootType));
                break;
        }
    }
    return nodes;
}
exports.convertIDL = convertIDL;
function convertTypedef(idl) {
    return ts.factory.createTypeAliasDeclaration([], ts.factory.createIdentifier(idl.name), undefined, convertType(idl.idlType));
}
function createIterableMethods(name, keyType, valueType, pair, async) {
    return [
        ts.factory.createMethodSignature([], async ? '[Symbol.asyncIterator]' : '[Symbol.iterator]', undefined, [], [], ts.factory.createExpressionWithTypeArguments(ts.factory.createIdentifier(async ? 'AsyncIterableIterator' : 'IterableIterator'), pair ? [ts.factory.createTupleTypeNode([keyType, valueType])] : [valueType])),
        ts.factory.createMethodSignature([], 'entries', undefined, [], [], ts.factory.createExpressionWithTypeArguments(ts.factory.createIdentifier(async ? 'AsyncIterableIterator' : 'IterableIterator'), [ts.factory.createTupleTypeNode([keyType, valueType])])),
        ts.factory.createMethodSignature([], 'keys', undefined, [], [], ts.factory.createExpressionWithTypeArguments(ts.factory.createIdentifier(async ? 'AsyncIterableIterator' : 'IterableIterator'), [keyType])),
        ts.factory.createMethodSignature([], 'values', undefined, [], [], ts.factory.createExpressionWithTypeArguments(ts.factory.createIdentifier(async ? 'AsyncIterableIterator' : 'IterableIterator'), [valueType])),
        ts.factory.createMethodSignature([], 'forEach', undefined, [], [
            ts.factory.createParameterDeclaration([], undefined, 'callbackfn', undefined, ts.factory.createFunctionTypeNode([], [
                ts.factory.createParameterDeclaration([], undefined, 'value', undefined, valueType),
                ts.factory.createParameterDeclaration([], undefined, pair ? 'key' : 'index', undefined, keyType),
                ts.factory.createParameterDeclaration([], undefined, pair ? 'iterable' : 'array', undefined, pair ? ts.factory.createTypeReferenceNode(name, []) : ts.factory.createArrayTypeNode(valueType)),
            ], ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword))),
            ts.factory.createParameterDeclaration([], undefined, 'thisArg', ts.factory.createToken(ts.SyntaxKind.QuestionToken), ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)),
        ], ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword))
    ];
}
function convertInterface(idl, options) {
    var members = [];
    var inheritance = [];
    if ('inheritance' in idl && idl.inheritance) {
        inheritance.push(ts.factory.createExpressionWithTypeArguments(ts.factory.createIdentifier(idl.inheritance), undefined));
    }
    idl.members.forEach(function (member) {
        switch (member.type) {
            case 'attribute':
                if (options === null || options === void 0 ? void 0 : options.emscripten) {
                    members.push(createAttributeGetter(member));
                    members.push(createAttributeSetter(member));
                }
                members.push(convertMemberAttribute(member));
                break;
            case 'operation':
                if (member.name === idl.name) {
                    members.push(convertMemberConstructor(member, options));
                }
                else {
                    members.push(convertMemberOperation(member));
                }
                break;
            case 'constructor':
                members.push(convertMemberConstructor(member, options));
                break;
            case 'field':
                members.push(convertMemberField(member));
                break;
            case 'const':
                members.push(convertMemberConst(member));
                break;
            case 'iterable': {
                var indexedPropertyGetter = idl.members.find(function (member) {
                    return member.type === 'operation' && member.special === 'getter' && member.arguments[0].idlType.idlType === 'unsigned long';
                });
                if ((indexedPropertyGetter && member.idlType.length === 1) || member.idlType.length === 2) {
                    var keyType = convertType(indexedPropertyGetter ? indexedPropertyGetter.arguments[0].idlType : member.idlType[0]);
                    var valueType = convertType(member.idlType[member.idlType.length - 1]);
                    members.push.apply(members, createIterableMethods(idl.name, keyType, valueType, member.idlType.length === 2, member.async));
                }
                break;
            }
            default:
                console.log(newUnsupportedError('Unsupported IDL member', member));
                break;
        }
    });
    if (options === null || options === void 0 ? void 0 : options.emscripten) {
        return ts.factory.createClassDeclaration(undefined, [], ts.factory.createIdentifier(idl.name), undefined, !inheritance.length ? undefined : [ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, inheritance)], members);
    }
    return ts.factory.createInterfaceDeclaration(undefined, [], ts.factory.createIdentifier(idl.name), undefined, !inheritance.length ? undefined : [ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, inheritance)], members);
}
function convertInterfaceIncludes(idl) {
    return ts.factory.createInterfaceDeclaration([], ts.factory.createIdentifier(idl.target), undefined, [
        ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
            ts.factory.createExpressionWithTypeArguments(ts.factory.createIdentifier(idl.includes), undefined),
        ]),
    ], []);
}
function createAttributeGetter(value) {
    return ts.factory.createMethodSignature([], 'get_' + value.name, undefined, [], [], convertType(value.idlType));
}
function createAttributeSetter(value) {
    var parameter = ts.factory.createParameterDeclaration([], undefined, value.name, undefined, convertType(value.idlType));
    return ts.factory.createMethodSignature([], 'set_' + value.name, undefined, [], [parameter], ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword));
}
function convertMemberOperation(idl) {
    var args = idl.arguments.map(convertArgument);
    return ts.factory.createMethodSignature([], idl.name, undefined, [], args, convertType(idl.idlType));
}
function convertMemberConstructor(idl, options) {
    var args = idl.arguments.map(convertArgument);
    if (options.emscripten) {
        return ts.factory.createMethodSignature([], 'constructor', undefined, [], args, undefined);
    }
    return ts.factory.createConstructSignature([], args, undefined);
}
function convertMemberField(idl) {
    var optional = !idl.required ? ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined;
    return ts.factory.createPropertySignature(undefined, ts.factory.createIdentifier(idl.name), optional, convertType(idl.idlType));
}
function convertMemberConst(idl) {
    return ts.factory.createPropertySignature([ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)], ts.factory.createIdentifier(idl.name), undefined, convertType(idl.idlType));
}
function convertMemberAttribute(idl) {
    return ts.factory.createPropertySignature([idl.readonly ? ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword) : null].filter(function (it) { return it != null; }), ts.factory.createIdentifier(idl.name), undefined, convertType(idl.idlType));
}
function convertArgument(idl) {
    var optional = idl.optional ? ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined;
    return ts.factory.createParameterDeclaration([], undefined, idl.name, optional, convertType(idl.idlType));
}
function convertType(idl) {
    if (typeof idl.idlType === 'string') {
        var type = baseTypeConversionMap.get(idl.idlType) || idl.idlType;
        switch (type) {
            case 'number':
                return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
            case 'string':
                return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
            case 'void':
                return ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword);
            default:
                return ts.factory.createTypeReferenceNode(type, []);
        }
    }
    if (idl.generic) {
        var type = baseTypeConversionMap.get(idl.generic) || idl.generic;
        return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(type), idl.idlType.map(convertType));
    }
    if (idl.union) {
        return ts.factory.createUnionTypeNode(idl.idlType.map(convertType));
    }
    console.log(newUnsupportedError('Unsupported IDL type', idl));
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
}
function convertEnum(idl) {
    return ts.factory.createTypeAliasDeclaration(undefined, ts.factory.createIdentifier(idl.name), undefined, ts.factory.createUnionTypeNode(idl.values.map(function (it) { return ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(it.value)); })));
}
function convertCallback(idl) {
    return ts.factory.createTypeAliasDeclaration(undefined, ts.factory.createIdentifier(idl.name), undefined, ts.factory.createFunctionTypeNode(undefined, idl.arguments.map(convertArgument), convertType(idl.idlType)));
}
function newUnsupportedError(message, idl) {
    return new Error("\n  ".concat(message, "\n  ").concat(JSON.stringify(idl, null, 2), "\n\n  Please file an issue at https://github.com/giniedp/webidl2ts and provide the used idl file or example.\n"));
}
