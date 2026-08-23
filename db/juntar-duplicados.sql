-- ═══════════════════════════════════════════════════════════════════════════
-- JUNTAR CADASTROS DUPLICADOS DE PROFISSIONAL
--
-- Quando uma conta é apagada no Supabase, o cadastro da profissional não some:
-- ele fica órfão, sem login. Se a pessoa for recriada depois, nasce um segundo
-- cadastro com o mesmo nome — e a tela de Comissões passa a mostrar as duas.
--
-- Este arquivo junta cada órfão no cadastro que tem login, levando junto os
-- atendimentos, os lançamentos de caixa e os movimentos de estoque. Nada de
-- histórico se perde.
--
-- Como usar: Supabase → SQL Editor → New query → cole tudo → Run.
-- Pode rodar quantas vezes quiser; se não houver duplicado, não faz nada.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  par record;
  juntados int := 0;
begin
  for par in
    select orfao.id as de, viva.id as para, viva.nome
    from profissionais orfao
    join profissionais viva
      on lower(trim(viva.nome)) = lower(trim(orfao.nome))
     and viva.user_id is not null
     and viva.id <> orfao.id
    where orfao.user_id is null
  loop
    update comandas    set profissional_id = par.para where profissional_id = par.de;
    update caixa       set profissional_id = par.para where profissional_id = par.de;
    update estoque_mov set profissional_id = par.para where profissional_id = par.de;
    delete from profissionais where id = par.de;
    juntados := juntados + 1;
    raise notice 'Juntado: % (o histórico foi para o cadastro com login)', par.nome;
  end loop;

  if juntados = 0 then
    raise notice 'Nenhum cadastro duplicado encontrado.';
  else
    raise notice '% cadastro(s) duplicado(s) juntado(s).', juntados;
  end if;
end $$;

-- Confira o resultado: deve sobrar uma linha por pessoa.
select nome,
       case when user_id is null then 'sem login' else 'acessa o app' end as acesso,
       case when ativo then 'ativa' else 'sem permissão' end as situacao
from profissionais
order by nome;
