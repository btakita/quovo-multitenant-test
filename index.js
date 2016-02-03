#!/usr/bin/env babel-node
require("dotenv").config();
import {info,log,warn,error,debug} from "js-console-color";
const XMLHttpRequest = require("xhr2")
    , co = require("co")
    , btoa = require("btoa-lite")
    , quovoUsername = process.env.QUOVO_USERNAME
    , quovoLogin = process.env.QUOVO_LOGIN
    , quovoPassword = process.env.QUOVO_PASSWORD
    , logPrefix = "quovo-multitenant-test";
co(function *() {
  try {
    const ctx = yield quovoUserCreateCmd({
      env: {
        quovoLogin: quovoLogin,
        quovoPassword: quovoPassword
      },
      quovoUsername: quovoUsername,
      postUsers_data: {
        username: quovoUsername,
        name: "Censible Test2",
        email: "development@censible.co",
        phone: ""
      }
    });
    log(ctx);
    return ctx;
  } catch (e) {
    error("error!", e);
  }
});
export default function *quovoUserCreateCmd(...args) {
  log(`${logPrefix}|quovoUserCreateCmd`);
  const ctx = clone(...args)
      , ctx2 = yield postUsers(ctx);
  return clone(ctx, {
    quovoUserId: ctx2.quovoUserId,
    quovoUser: ctx2.quovoUser
  });
}
function *postUsers(...args) {
  log(`${logPrefix}|postUsers`);
  const ctx = clone(...args)
      , ctx2 = yield postTokens(ctx)
      , ctx3 = yield getUsers(ctx2)
      , ctx3_assert = assert_quovoUsername_notIn_quovoUsers(ctx3)
      , ctx4 = yield xhr(contentTypeJSON_append(ctx3), {
          method: "POST",
          url: "https://api.quovo.com/v2/users",
          data: JSON.stringify(ctx.postUsers_data)});
  return clone(ctx, {quovoUser: JSON.parse(ctx4.request.responseText).user});
}
function assert_quovoUsername_notIn_quovoUsers() {
  log(`${logPrefix}|assert_quovoUsername_notIn_quovoUsers`);
  const ctx = clone(...arguments)
      , quovoUsername = ctx.quovoUsername
      , quovoUsers = ctx.quovoUsers;
  if (!quovoUsername) throw "ctx.quovoUsername missing";
  if (!quovoUsers) throw "ctx.quovoUsers missing";
  if(quovoUsers.find(quovoUser => quovoUser.username == quovoUsername)) {
    throw `ctx.quovoUsername ${quovoUsername} should not be in ${JSON.stringify(quovoUsers)}`
  }
  info(`ctx.quovoUsername "${quovoUsername}" is not in GET https://api.quovo.com/v2/users`);
}
export function *getUsers(...args) {
  log(`${logPrefix}|getUsers`);
  const ctx = clone(...args)
      , ctx2 = yield postTokens(ctx)
      , ctx3 = yield xhr(ctx2, {method: "GET", url: "https://api.quovo.com/v2/users"});
  return clone(ctx, {quovoUsers: JSON.parse(ctx3.request.responseText).users});
}
function *postTokens(...args) {
  const ctx = clone(...args);
  log(`${logPrefix}|postTokens`);
  if (ctx.quovoToken) return ctx;
  const ctx2 = contentTypeJSON_append(ctxRequest_clone(...args, {url: "https://api.quovo.com/v2/tokens"}))
      , ctx3 = yield xhr(ctx2, {method: "POST", data: JSON.stringify(quovoTokenData(ctx2))});
  return clone(ctx, {quovoToken: JSON.parse(ctx3.request.responseText).access_token});
}
function xhr() {
  const ctx = clone(...arguments);
  if (!ctx.url && !ctx.path) throw "no url or path defined";
  const method = (ctx.method || "GET").toUpperCase()
      , url = ctx.url || `${ctx.urlBase}${ctx.path}`
      , request = new XMLHttpRequest()
      , beforeSend = ctx.beforeSend || function() {}
      , data = ctx.data;
  log(`${logPrefix}|xhr`, method, url, data);
  return new Promise((resolve, reject) => {
    log(`${logPrefix}|xhr|2`, method, url);
    const ctx2 = clone_cloned_add(ctx, {request: request, resolve: resolve, reject: reject});
    request.open(method, url, true);
    setRequestHeaders(ctx2);
    request.onload = xhr_onload_fn(ctx2);
    request.onerror = xhr_onerror_fn(ctx2);
    beforeSend(request);
    request.send(data);
  });
}
function xhr_onload_fn(ctx) {
  return function() {
    log(`${logPrefix}|xhrOnloadFn`);
    const request = ctx.request
        , ctx2 = clone(...ctx.cloned, {request: request});
    if (request.status >= 200 && request.status < 400) {
      log(`${logPrefix}|xhrOnloadFn|success`, request.status);
      ctx.resolve(ctx2);
    } else {
      warn(`${logPrefix}|xhrOnloadFn|error\n`, ctx.method, ctx.url || ctx.path, ctx.data, "\n", request.status, request.responseText);
      // error from the server
      ctx.reject(ctx2);
    }
  };
}
function xhr_onerror_fn(ctx) {
  return function(e) {
    warn(`${logPrefix}|xhrOnerrorFn`, e);
    // connection error
    ctx.reject(e);
  };
}
function setRequestHeaders() {
  const ctx = clone(...arguments)
      , request = ctx.request
      , headers = ctx.headers || {}
      , quovoToken = ctx.quovoToken
      ;
  log(`${logPrefix}|setRequestHeaders`);
  if (quovoToken) {
    log(`${logPrefix}|setRequestHeaders|quovoToken`, quovoToken);
    const quovoTokenBearer = quovoToken.token;
    headers["Authorization"] = `Bearer ${quovoTokenBearer}`;
  }
  Object.keys(headers).forEach(function(headerKey) {
    request.setRequestHeader(
      headerKey,
      headers[headerKey]
    );
  });
  return ctx;
}
function ctxRequest_clone(...args) {
  const ctx = clone(...args);
  return contentTypeJSON_append(ctx, {"Authorization": `Basic ${quovoCredentials(ctx)}`});
}
export function contentTypeJSON_append(ctx, ...rest) {
  return headers_init(ctx, {"Content-Type": "application/json"}, ...rest);
}
export function headers_init(ctx, ...rest) {
  const ctx2 = clone(ctx)
    , headers = ctx2.headers || {};
  log("headers_init");
  Object.assign(headers, ...rest);
  ctx2.headers = headers;
  return ctx2;
}
export function clone(...cloned) {
  return Object.assign.apply(Object, [{}].concat(...cloned));
}
export function clone_cloned_add(...cloned) {
  return Object.assign.apply(Object, [{}].concat(...cloned, {cloned: cloned}));
}
function quovoTokenData() {
  const ctx = clone(...arguments)
      , quovoTokenPrefix = ctx.quovoTokenPrefix || (ctx.env && ctx.env.quovoTokenPrefix) || "quovo-multitenant-test";
  return {name: `${quovoTokenPrefix}-${yyyymmddhhmmss()}-${Math.random()}`};
}
export function yyyymmddhhmmss(date) {
  date = date || new Date();
  return date.getFullYear() +
    pad2(date.getMonth() + 1) +
    pad2(date.getDate()) +
    pad2(date.getHours()) +
    pad2(date.getMinutes()) +
    pad2(date.getSeconds());
}
function pad2(n) {  // always returns a string
  return (n < 10 ? '0' : '') + n;
}
function quovoCredentials(ctx) {
  const env = ctx.env
      , quovoLogin = ctx.quovoLogin || env.quovoLogin
      , quovoPassword = ctx.quovoPassword || env.quovoPassword;
  return btoa(`${quovoLogin}:${quovoPassword}`);
}
