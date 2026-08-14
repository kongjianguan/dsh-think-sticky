'use strict'
/**
 * @local/dsh-think-sticky — host half.
 * Pure client-side CSS plugin; the host entry exists only to satisfy the
 * Cordis loader contract (a plugin must be a function or an object with an
 * `apply` method). All behavior lives in lib/client.js.
 */
const name = 'dsh-think-sticky'

function apply(/* ctx */) {
  // No host-side services, events, or routes.
}

module.exports = { name, apply }
