/**
 * Wrapper seguro para chamadas do Supabase com verificação de autenticação
 * Garante que a sessão seja válida antes de fazer requisições
 */

import { supabase } from "./supabase";
import { getUsableSession } from "./api";

/**
 * Erro customizado para falhas de autenticação
 */
export class AuthSessionError extends Error {
  constructor(message = "Sessão expirada ou inválida") {
    super(message);
    this.name = "AuthSessionError";
  }
}

/**
 * Wrapper que verifica a sessão antes de executar uma operação Supabase
 * @param {Function} operation - Função que retorna uma Promise com operação Supabase
 * @param {Object} options - Opções adicionais
 * @param {boolean} options.requireAuth - Se true, lança erro se não houver sessão
 * @param {boolean} options.autoRefresh - Se true, tenta refresh automático
 * @returns {Promise} - Resultado da operação Supabase
 */
export const withAuthCheck = async (operation, options = {}) => {
  const { requireAuth = true, autoRefresh = true } = options;

  // Verificar se temos uma sessão válida
  const session = await getUsableSession();

  if (!session) {
    if (requireAuth) {
      throw new AuthSessionError("Sessão expirada. Por favor, faça login novamente.");
    }
    // Se não requer auth, executa mesmo sem sessão
    return await operation();
  }

  // Se tivermos sessão, executa a operação
  try {
    return await operation();
  } catch (error) {
    // Se o erro for relacionado a JWT expirado, tentar refresh
    if (autoRefresh && isJwtError(error)) {
      console.warn("[SupabaseWrapper] Erro de JWT detectado, tentando refresh...");
      const refreshed = await getUsableSession();
      
      if (refreshed) {
        console.log("[SupabaseWrapper] Refresh bem-sucedido, retrying operação...");
        return await operation();
      }
    }
    
    throw error;
  }
};

/**
 * Verifica se o erro está relacionado a JWT expirado
 */
const isJwtError = (error) => {
  if (!error) return false;
  
  const errorMessage = String(error.message || "").toLowerCase();
  const errorCode = String(error.code || "").toLowerCase();
  
  return (
    errorMessage.includes("jwt") ||
    errorMessage.includes("token") ||
    errorMessage.includes("expired") ||
    errorMessage.includes("unauthorized") ||
    errorCode.includes("pgrst301") || // Erro JWT do Supabase
    errorCode.includes("pgrst116") // Erro de autenticação do Supabase
  );
};

/**
 * Wrapper específico para operações de leitura (SELECT)
 */
export const withAuthRead = (operation) => {
  return withAuthCheck(operation, { requireAuth: false, autoRefresh: true });
};

/**
 * Wrapper específico para operações de escrita (INSERT, UPDATE, DELETE)
 */
export const withAuthWrite = (operation) => {
  return withAuthCheck(operation, { requireAuth: true, autoRefresh: true });
};

/**
 * Verifica se a sessão atual é válida sem fazer refresh
 */
export const isSessionValid = async () => {
  try {
    const session = await getUsableSession();
    return session !== null;
  } catch {
    return false;
  }
};

/**
 * Força um refresh da sessão
 */
export const forceSessionRefresh = async () => {
  const { refreshSupabaseSessionOnce } = await import("./api");
  return await refreshSupabaseSessionOnce();
};