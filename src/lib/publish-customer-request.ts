import {
  beginPostgrestAuthDiagnostic,
  supabase,
  type PostgrestAuthDiagnostic,
} from '@/lib/supabase';

const REQUEST_IMAGE_BUCKET = 'request-images';
const REQUEST_IMAGE_SIZE_LIMIT = 8 * 1024 * 1024;

const imageFormats = {
  jpg: { extension: 'jpg', contentType: 'image/jpeg' },
  jpeg: { extension: 'jpg', contentType: 'image/jpeg' },
  png: { extension: 'png', contentType: 'image/png' },
  webp: { extension: 'webp', contentType: 'image/webp' },
} as const;

const mimeExtensions: Record<string, keyof typeof imageFormats> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type CustomerRequestPublishProgress = {
  requestId: string;
  imagePath: string | null;
  imagePathSaved: boolean;
};

type PublishCustomerRequestInput = {
  customerId: string;
  title: string;
  details: string;
  category: string;
  requestedArea: string;
  imageUri: string | null;
  imageMimeType: string | null;
};

type LocalImage = {
  bytes: ArrayBuffer;
  contentType: string;
  extension: string;
};

type PublishStep =
  | 'configuration'
  | 'session'
  | 'image_preflight'
  | 'draft_insert'
  | 'draft_lookup'
  | 'draft_update'
  | 'image_upload'
  | 'image_path_save'
  | 'publish_request';

type ErrorField = 'code' | 'message' | 'details' | 'hint';

function sanitizeDiagnosticText(value: string, privateValues: string[]) {
  let sanitized = value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, '[redacted email]')
    .replace(/\bBearer\s+\S+/giu, 'Bearer [redacted]')
    .replace(/\b(?:sb_secret_|sb_publishable_)[A-Za-z0-9_-]+/gu, '[redacted key]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '[redacted token]')
    .replace(
      /\b(password|access_token|refresh_token|token|secret)\s*[:=]\s*[^,\s;]+/giu,
      '$1=[redacted]',
    );

  for (const privateValue of privateValues) {
    if (privateValue) sanitized = sanitized.split(privateValue).join('[redacted request data]');
  }

  return sanitized.slice(0, 1200);
}

function getDiagnosticErrorFields(error: unknown, privateValues: string[]) {
  const errorRecord =
    typeof error === 'object' && error !== null
      ? (error as Partial<Record<ErrorField, unknown>>)
      : null;
  const message =
    typeof errorRecord?.message === 'string'
      ? errorRecord.message
      : error instanceof Error
        ? error.message
        : 'Unknown publish error';
  const code =
    typeof errorRecord?.code === 'string'
      ? errorRecord.code
      : /^[A-Z][A-Z0-9_]+$/u.test(message)
        ? message
        : null;

  return {
    code: code ? sanitizeDiagnosticText(code, privateValues) : null,
    message: sanitizeDiagnosticText(message, privateValues),
    details:
      typeof errorRecord?.details === 'string'
        ? sanitizeDiagnosticText(errorRecord.details, privateValues)
        : null,
    hint:
      typeof errorRecord?.hint === 'string'
        ? sanitizeDiagnosticText(errorRecord.hint, privateValues)
        : null,
  };
}

function getFailingPolicyCondition(error: unknown, authDiagnostic: PostgrestAuthDiagnostic | null) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : null;
  if (code !== '42501') return null;
  if (authDiagnostic) return authDiagnostic.failingPolicyCondition;
  return 'not captured at the PostgREST request';
}

function logPublishFailure(
  step: PublishStep,
  authDiagnostic: PostgrestAuthDiagnostic | null,
  error: unknown,
  input: PublishCustomerRequestInput,
) {
  if (!__DEV__) return;

  const privateValues = [
    input.customerId,
    input.title,
    input.title.trim(),
    input.details,
    input.details.trim(),
    input.category,
    input.category.trim(),
    input.requestedArea,
    input.requestedArea.trim(),
    input.imageUri ?? '',
  ];

  console.warn('[DALLNI request publish diagnostic]', {
    step,
    postgrestAuthorization: authDiagnostic,
    failingPolicyCondition: getFailingPolicyCondition(error, authDiagnostic),
    error: getDiagnosticErrorFields(error, privateValues),
  });
}

function getImageFormat(uri: string, mimeType: string | null) {
  const uriWithoutQuery = uri.split(/[?#]/u, 1)[0] ?? uri;
  const uriExtension = uriWithoutQuery.split('.').pop()?.toLowerCase();
  const extension =
    uriExtension && uriExtension in imageFormats
      ? (uriExtension as keyof typeof imageFormats)
      : mimeExtensions[mimeType?.toLowerCase() ?? ''];

  return extension ? imageFormats[extension] : null;
}

async function readLocalImage(uri: string, mimeType: string | null): Promise<LocalImage> {
  const imageFormat = getImageFormat(uri, mimeType);
  if (!imageFormat) throw new Error('REQUEST_IMAGE_UNSUPPORTED_TYPE');

  let response: Response;
  try {
    response = await fetch(uri);
  } catch {
    throw new Error('REQUEST_IMAGE_READ_FAILED');
  }
  if (!response.ok) throw new Error('REQUEST_IMAGE_READ_FAILED');

  let bytes: ArrayBuffer;
  try {
    bytes = await response.arrayBuffer();
  } catch {
    throw new Error('REQUEST_IMAGE_READ_FAILED');
  }
  if (bytes.byteLength === 0) throw new Error('REQUEST_IMAGE_READ_FAILED');
  if (bytes.byteLength > REQUEST_IMAGE_SIZE_LIMIT) throw new Error('REQUEST_IMAGE_TOO_LARGE');

  return {
    bytes,
    contentType: imageFormat.contentType,
    extension: imageFormat.extension,
  };
}

export async function publishCustomerRequest(
  input: PublishCustomerRequestInput,
  currentProgress: CustomerRequestPublishProgress | null,
  onProgress: (progress: CustomerRequestPublishProgress) => void,
) {
  let step: PublishStep = 'configuration';
  let authDiagnostic: PostgrestAuthDiagnostic | null = null;

  try {
    if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');

    const client = supabase;
    let progress = currentProgress;
    let localImage: LocalImage | null = null;

    step = 'session';
    const {
      data: { user: authenticatedUser },
      error: userError,
    } = await client.auth.getUser();
    if (userError) throw userError;
    if (!authenticatedUser) throw new Error('REQUEST_AUTH_SERVER_USER_MISSING');
    const authenticatedCustomerId = authenticatedUser.id;

    if (input.imageUri && !progress?.imagePath) {
      step = 'image_preflight';
      localImage = await readLocalImage(input.imageUri, input.imageMimeType);
    }

    if (!progress) {
      step = 'draft_insert';
      const {
        data: { session: insertSession },
        error: insertSessionError,
      } = await client.auth.getSession();
      if (insertSessionError) throw insertSessionError;

      const insertCustomerId = authenticatedUser.id;
      // `status` is not insertable by this role, so let Postgres apply its draft default.
      const defaultToNull = false;

      const finishAuthDiagnostic = beginPostgrestAuthDiagnostic({
        sessionAccessToken: insertSession?.access_token ?? '',
        validatedUserId: authenticatedUser.id,
      });
      try {
        const { data, error } = await client
          .from('requests')
          .insert(
            [
              {
                customer_id: insertCustomerId,
                title: input.title,
                details: input.details.trim(),
                category: input.category,
                requested_area: input.requestedArea.trim(),
              },
            ],
            { defaultToNull },
          )
          .select('id')
          .single();

        if (error) throw error;

        progress = { requestId: data.id, imagePath: null, imagePathSaved: false };
        onProgress(progress);
      } finally {
        authDiagnostic = finishAuthDiagnostic();
      }
    } else {
      step = 'draft_lookup';
      const { data, error } = await client
        .from('requests')
        .select('status, image_path')
        .eq('id', progress.requestId)
        .eq('customer_id', authenticatedCustomerId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('REQUEST_DRAFT_NOT_FOUND');
      if (data.status === 'open') return progress.requestId;
      if (data.status !== 'draft') throw new Error('REQUEST_DRAFT_NOT_EDITABLE');

      const storedImagePath = data.image_path ?? progress.imagePath;
      progress = {
        ...progress,
        imagePath: storedImagePath,
        imagePathSaved: Boolean(data.image_path) && data.image_path === storedImagePath,
      };
      onProgress(progress);

      step = 'draft_update';
      const { error: updateError } = await client
        .from('requests')
        .update({
          title: input.title,
          details: input.details.trim(),
          category: input.category,
          requested_area: input.requestedArea.trim(),
        })
        .eq('id', progress.requestId)
        .eq('customer_id', authenticatedCustomerId)
        .eq('status', 'draft');

      if (updateError) throw updateError;
    }

    if (input.imageUri && !progress.imagePath) {
      if (!localImage) {
        step = 'image_preflight';
        localImage = await readLocalImage(input.imageUri, input.imageMimeType);
      }

      step = 'image_upload';
      const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
      const imagePath = `${progress.requestId}/image-${uniqueSuffix}.${localImage.extension}`;
      const { data, error } = await client.storage
        .from(REQUEST_IMAGE_BUCKET)
        .upload(imagePath, localImage.bytes, {
          cacheControl: '3600',
          contentType: localImage.contentType,
          upsert: false,
        });

      if (error) throw error;

      progress = { ...progress, imagePath: data.path, imagePathSaved: false };
      onProgress(progress);
    }

    if (progress.imagePath && !progress.imagePathSaved) {
      step = 'image_path_save';
      const { error } = await client
        .from('requests')
        .update({ image_path: progress.imagePath })
        .eq('id', progress.requestId)
        .eq('customer_id', authenticatedCustomerId)
        .eq('status', 'draft');

      if (error) throw error;

      progress = { ...progress, imagePathSaved: true };
      onProgress(progress);
    }

    step = 'publish_request';
    const { error } = await client.rpc('dallni_publish_request', {
      p_request_id: progress.requestId,
      p_accept_shop_sharing: true,
    });

    if (error) throw error;
    return progress.requestId;
  } catch (error) {
    logPublishFailure(
      step,
      authDiagnostic,
      error,
      input,
    );
    throw error;
  }
}
