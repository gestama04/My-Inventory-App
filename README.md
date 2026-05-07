# VitaStreak 💊🔥

**VitaStreak** é uma aplicação mobile feita em **React Native + Expo** para acompanhar rotinas de suplementos, vitaminas e hábitos de toma.

A app permite adicionar suplementos manualmente ou através de uma fotografia do rótulo com IA, criar lembretes, marcar tomas como concluídas, acompanhar streaks, consultar histórico e receber uma análise geral da rotina.

> Informação geral. A app não substitui aconselhamento médico.

---

## ✨ Funcionalidades

### Conta e perfil

- Registo e login com Supabase Auth
- Confirmação de email
- Recuperação de palavra-passe por código
- Perfil com nome, data de nascimento e foto
- Upload da foto de perfil para Cloudinary
- Eliminação de conta através de Supabase Edge Function

### Suplementos

- Adicionar, editar e apagar suplementos
- Guardar nome, marca, ingrediente principal, dose, unidade, tamanho da toma e instruções do rótulo
- Guardar fotografia do suplemento
- Guardar ingredientes ativos detetados
- Guardar insights gerados por IA
- Definir suplemento como ativo/inativo
- Ver detalhes de cada suplemento

### Rotina e lembretes

- Uma ou várias tomas por dia
- Frequência diária
- Dias específicos da semana
- Dia sim / dia não
- Intervalo personalizado em dias
- Notificações locais com Expo Notifications
- Reagendamento automático ao editar suplementos
- Ação rápida para marcar todas as tomas do dia

### Streak e histórico

- Streak diário baseado nas tomas agendadas para cada dia
- Progresso diário em percentagem
- Widget semanal de consistência
- Histórico dos últimos 30 dias
- Estado por toma: tomado / não tomado

### IA

- Leitura de rótulos por imagem com Google Gemini
- Extração automática de:
  - nome
  - marca
  - ingrediente principal
  - dose
  - unidade
  - tamanho da toma
  - quantidade da embalagem
  - instruções visíveis no rótulo
  - ingredientes ativos
  - resumo, benefícios gerais e cautelas
- Análise geral da rotina com IA
- Coach local com sugestões simples sobre duplicações, horários e pontos a confirmar

---

## 🧱 Stack técnica

- **React Native**
- **Expo SDK 54**
- **Expo Router**
- **TypeScript**
- **Supabase**
  - Auth
  - PostgreSQL
  - Edge Functions
  - Row Level Security
- **Cloudinary**
- **Google Gemini**
- **Expo Notifications**
- **AsyncStorage**
- **React Native SVG**
- **Expo Image Picker**
- **Expo Image Manipulator**
- **Expo File System**

---

## 📁 Estrutura principal

```txt
app/
  _layout.tsx
  index.tsx
  welcome-vitastreak.tsx
  setup-vitastreak.tsx
  login-vitastreak.tsx
  register-vitastreak.tsx
  reset-password-code.tsx
  vitastreak-home.tsx
  today.tsx
  supplements.tsx
  supplement-details.tsx
  add-supplement.tsx
  edit-supplement.tsx
  history.tsx
  ai-routine-review.tsx
  ai-coach.tsx
  profile-vitastreak.tsx
  settings-vitastreak.tsx
  legal-vitastreak.tsx

components/
  CustomAlert.tsx
  ThemedText.tsx
  ThemedView.tsx
  ...

hooks/
  useCustomAlert.tsx
  useColorScheme.ts
  useThemeColor.ts

services/
  language-service.ts
  supplements/
    supplement-service.ts
    supplement-notification-service.ts
    supplement-suggestions.ts
    gemini-supplement-service.ts
    ai-routine-review-service.ts
    ai-coach-service.ts

supabase/
  config.toml
  functions/
    analyze-supplement-label/
      index.ts
      deno.json
    review-supplement-routine/
      index.ts
      deno.json
    delete-user/
      index.ts
      deno.json

types/
  supplements/
    supplement.ts

utils/
  withTimeout.ts

assets/
  images/
  documents/
  fonts/
```

---

## 🔐 Variáveis de ambiente

Cria um ficheiro `.env` na raiz do projeto.

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset
```

A chave Gemini **não deve ficar no frontend**. Deve ficar como secret no Supabase:

```bash
npx supabase secrets set GEMINI_API_KEY=your_gemini_api_key
```

Para a função de apagar conta, confirma também os secrets do projeto:

```bash
npx supabase secrets set PROJECT_URL=your_supabase_url
npx supabase secrets set PROJECT_ANON_KEY=your_supabase_anon_key
npx supabase secrets set PROJECT_SERVICE_ROLE_KEY=your_service_role_key
```

> Nunca coloques `SERVICE_ROLE_KEY`, API keys privadas ou secrets reais no código da app.

---

## ⚙️ Instalação

```bash
npm install
```

Se existirem conflitos de dependências:

```bash
npm install --legacy-peer-deps
```

---

## ▶️ Desenvolvimento

```bash
npx expo start
```

O script principal usa dev client:

```bash
npm run start
```

Outros comandos úteis:

```bash
npm run android
npm run ios
npm run web
npm run lint
npm run test
```

---

## 🧩 Supabase

### 1. Login

```bash
npx supabase login
```

### 2. Ligar ao projeto

```bash
npx supabase link --project-ref your_project_ref
```

### 3. Confirmar secrets

```bash
npx supabase secrets list
```

### 4. Deploy das Edge Functions

```bash
npx supabase functions deploy analyze-supplement-label
npx supabase functions deploy review-supplement-routine
npx supabase functions deploy delete-user
```

### 5. Ver funções publicadas

```bash
npx supabase functions list
```

---


## 🤖 IA com Gemini

A leitura de rótulos é feita pela Edge Function:

```txt
supabase/functions/analyze-supplement-label
```

Fluxo:

1. A app escolhe ou tira uma foto.
2. A imagem é redimensionada e convertida para base64.
3. A app chama `supabase.functions.invoke('analyze-supplement-label')`.
4. A Edge Function envia a imagem ao Gemini.
5. A resposta é normalizada e devolvida à app.

A análise da rotina usa:

```txt
supabase/functions/review-supplement-routine
```

O coach local usa regras dentro de:

```txt
services/supplements/ai-coach-service.ts
```

---

## 📸 Cloudinary

O Cloudinary é usado para guardar imagens de:

- suplementos
- foto de perfil

O upload usa um preset unsigned configurado no Cloudinary.

Variáveis necessárias:

```env
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
```

---

## 🔔 Notificações

As notificações são locais e usam:

```txt
expo-notifications
```

O serviço principal está em:

```txt
services/supplements/supplement-notification-service.ts
```

A app agenda lembretes com base em:

- `reminder_time`
- `reminder_times`
- `frequency_type`
- `days_of_week`
- `interval_days`
- `is_active`

Ao editar ou apagar um suplemento, as notificações antigas são canceladas e reagendadas.

---

## 📱 Build Android

O projeto está configurado para gerar `.aab` em produção.

```bash
eas build -p android --profile production
```

Para APK interno:

```bash
eas build -p android --profile preview
```

Configuração atual:

```txt
Android package: com.gestama.vitastreak
iOS bundle identifier: com.gestama.vitastreak
App version: 1.0.0
Android versionCode: 4
```

---


## ✅ Checklist antes de lançar

- [ ] `android.versionCode` aumentado
- [ ] `.env` sem secrets privados
- [ ] `GEMINI_API_KEY` configurada nos Supabase secrets
- [ ] `PROJECT_SERVICE_ROLE_KEY` apenas no Supabase
- [ ] Edge Functions publicadas
- [ ] RLS ativo nas tabelas públicas
- [ ] Supabase Advisor sem issues críticas
- [ ] Cloudinary upload preset configurado
- [ ] Notificações testadas em Android real
- [ ] Registo/login testado
- [ ] Recuperação de password testada
- [ ] Adicionar suplemento testado
- [ ] Editar suplemento testado
- [ ] Histórico testado
- [ ] Streak testado
- [ ] Eliminação de conta testada
- [ ] Política de privacidade e termos disponíveis

---

## 🧪 Testes manuais recomendados

### Autenticação

- Criar conta nova
- Confirmar email
- Fazer login
- Recuperar palavra-passe
- Terminar sessão

### Suplementos

- Adicionar suplemento manualmente
- Adicionar suplemento por foto
- Editar suplemento
- Apagar suplemento
- Ver detalhes do suplemento

### Rotina

- Marcar toma como feita
- Desmarcar toma
- Marcar todas
- Testar múltiplas tomas no mesmo dia
- Testar dias específicos
- Testar dia sim / dia não
- Testar intervalo personalizado

### Histórico e streak

- Confirmar histórico dos últimos 30 dias
- Confirmar dias tomados e não tomados
- Confirmar atualização imediata do widget semanal
- Confirmar streak depois de completar o dia

### IA

- Analisar rótulo legível
- Analisar rótulo pouco legível
- Testar falha temporária da API
- Testar análise de rotina com suplementos existentes

---

## ⚠️ Nota médica

VitaStreak é uma ferramenta de organização e consistência.

A app pode mostrar informação geral sobre suplementos, ingredientes, horários e possíveis pontos a confirmar, mas:

- não faz diagnóstico
- não recomenda doses médicas
- não substitui aconselhamento médico
- não avalia a tua medicação, análises ou contexto clínico completo

Segue sempre a recomendação do teu profissional de saúde.

---

## 📄 Licença

Projeto privado.

---

## 👤 Autor

Desenvolvido por **Gestama**.
