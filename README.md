# My Inventory App 📦

Aplicação de gestão de inventário pessoal desenvolvida com React Native e Expo.

## Tecnologias

- **Frontend**: React Native + Expo
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Armazenamento de Imagens**: Cloudinary
- **IA**: Google Gemini (classificação de produtos e insights)

## Configuração

### 1. Instalar dependências

```bash
npm install --legacy-peer-deps
```

### 2. Configurar Supabase

1. Cria uma conta em [supabase.com](https://supabase.com)
2. Cria um novo projeto
3. Vai ao **SQL Editor** e executa o script `supabase-schema.sql` para criar as tabelas
4. Vai a **Settings > API** e copia:
   - **Project URL**
   - **anon/public key**
5. Edita o ficheiro `supabase-config.ts`:

```typescript
const SUPABASE_URL = 'https://SEU_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY_AQUI';
```

6. Vai a **Authentication > Settings**:
   - Ativa "Enable email confirmations"
   - Adiciona `myinventoryapp://` aos Redirect URLs

7. Vai a **Database > Replication**:
   - Certifica-te que `inventory_items` está habilitado para Realtime

### 3. Configurar Cloudinary

1. Cria uma conta em [cloudinary.com](https://cloudinary.com)
2. Vai a **Settings > Upload**:
   - Cria um novo **Upload Preset** chamado `inventory_app`
   - Configura como **Unsigned** para permitir uploads do app
3. Edita o ficheiro `cloudinary-config.ts`:

```typescript
export const CLOUDINARY_CONFIG = {
  cloudName: 'SEU_CLOUD_NAME',
  apiKey: 'SUA_API_KEY',
  apiSecret: 'SUA_API_SECRET',
  uploadPreset: 'inventory_app',
};
```

### 4. Configurar Google Gemini (opcional)

1. Vai a [makersuite.google.com](https://makersuite.google.com)
2. Cria uma API Key
3. Edita os ficheiros que usam Gemini (`app/add.tsx`, `app/statistics.tsx`, `app/home.tsx`) e substitui a API key

### 5. Iniciar a app

```bash
npx expo start
```

## Estrutura do Projeto

```
├── app/                    # Ecrãs da aplicação (file-based routing)
│   ├── _layout.tsx         # Layout principal
│   ├── index.tsx           # Página inicial (redirect)
│   ├── home.tsx            # Dashboard
│   ├── inventory.tsx       # Lista de inventário
│   ├── add.tsx             # Adicionar produto
│   ├── edit.tsx            # Editar produto
│   ├── ...
├── components/             # Componentes reutilizáveis
├── services/               # Serviços (notificações, etc.)
├── hooks/                  # Custom hooks
├── constants/              # Constantes e temas
├── types/                  # Definições TypeScript
├── supabase-config.ts      # Configuração do Supabase
├── supabase-service.ts     # Serviços Supabase
├── supabase-listeners.ts   # Gestão de listeners
├── supabase-schema.sql     # Schema da base de dados
├── cloudinary-config.ts    # Configuração do Cloudinary
├── cloudinary-service.ts   # Serviços de upload de imagens
├── inventory-service.ts    # Serviços de inventário
├── auth-context.tsx        # Contexto de autenticação
└── ...
```

## Funcionalidades

- ✅ Autenticação (registo, login, recuperação de password)
- ✅ Verificação de email
- ✅ CRUD de produtos
- ✅ Upload de fotos de produtos
- ✅ Classificação automática com IA (Google Gemini)
- ✅ Leitura de códigos QR/barras
- ✅ Gestão de categorias
- ✅ Alertas de stock baixo
- ✅ Notificações push
- ✅ Modo offline com sincronização
- ✅ Tema claro/escuro
- ✅ Estatísticas e insights com IA
- ✅ Exportação de dados (PDF, JSON)
- ✅ Histórico de alterações

## Licença

Projeto privado.
