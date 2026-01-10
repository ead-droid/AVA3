import { supabase } from './supabaseClient.js';

const msgEl = document.getElementById('msg');
const form = document.getElementById('reset-form');

function setMsg(type, html) {
  msgEl.className = `alert
