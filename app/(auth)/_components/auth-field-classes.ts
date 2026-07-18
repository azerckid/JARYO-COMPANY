/**
 * JC-045: public/sign-in stays on an explicit light field palette.
 * Global theme may set html.dark (OS/system), but auth inputs must not inherit
 * light-on-white foreground from --foreground.
 */
export const AUTH_INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 caret-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'

export const AUTH_PASSWORD_INPUT_CLASS = `${AUTH_INPUT_CLASS} pr-10`
