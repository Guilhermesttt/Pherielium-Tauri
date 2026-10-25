/**
 * A busca expansível fica aberta enquanto a pessoa a abriu OU enquanto há texto digitado: com texto,
 * o filtro está valendo e o campo não pode voltar a ser um botão escondendo o que foi digitado.
 */
export function isSearchOpen(opened: boolean, value: string): boolean {
  return opened || value.length > 0;
}
