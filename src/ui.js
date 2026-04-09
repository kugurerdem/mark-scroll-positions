// @ts-check

import {createContext, h, render} from '../vendor/preact.module.js'
import {
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from '../vendor/preact-hooks.module.js'
import htm from '../vendor/htm.module.js'

export {createContext, h, render, useCallback, useContext, useEffect, useRef, useState}

export const html = htm.bind(h)
