import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  functions: { invoke: vi.fn() },
}));
vi.mock('@/lib/supabase/client', () => ({ supabase }));

import {
  countActiveProductsInCategory,
  getAdminCategory,
  saveCategory,
  setCategoryActive,
} from './categoryAdminService';
import {
  getAdminProduct,
  listAdminDealTags,
  saveProduct,
  setProductActive,
} from './productAdminService';
import { friendlySaveError } from './saveErrors';
import { requestUploadSignature, uploadImage } from './uploadService';

/** A chainable stand-in for the Supabase query builder that records every call. */
function fakeQuery(result) {
  const calls = [];
  const query = new Proxy(
    {},
    {
      get(_target, name) {
        if (name === 'calls') return calls;
        if (name === 'then')
          return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
        return (...args) => {
          calls.push([name, args]);
          return query;
        };
      },
    },
  );
  return query;
}
const callsOf = (query, name) => query.calls.filter(([method]) => method === name);

const ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => vi.resetAllMocks());

describe('friendlySaveError', () => {
  it('maps database codes to safe messages and never leaks raw text', () => {
    expect(
      friendlySaveError({ code: '23505', message: 'duplicate key products_slug_key' }, 'product'),
    ).toMatch(/slug is already taken/);
    expect(friendlySaveError({ code: '23505', message: 'other' }, 'category')).toMatch(
      /already exists/,
    );
    expect(friendlySaveError({ code: '42501' }, 'product')).toMatch(/permission/);
    expect(friendlySaveError({ code: 'P0002' }, 'product')).toMatch(/no longer exists/);
    expect(friendlySaveError({ code: '23503' }, 'product')).toMatch(/valid category/);
    expect(friendlySaveError({ code: '23514' }, 'product')).toMatch(/rejected/);
    const unknown = friendlySaveError({ code: 'XX000', message: 'secret internals' }, 'product');
    expect(unknown).toMatch(/could not save the product/);
    expect(unknown).not.toMatch(/secret/);
    expect(friendlySaveError(null, 'product')).toMatch(/could not save/);
  });
});

describe('saveProduct', () => {
  it('calls the database function with the id and payload and returns the new id', async () => {
    supabase.rpc.mockResolvedValue({ data: ID, error: null });
    const payload = { title: 'T' };

    expect(await saveProduct(null, payload)).toBe(ID);
    expect(supabase.rpc).toHaveBeenCalledWith('admin_save_product', {
      p_id: null,
      p_payload: payload,
    });

    await saveProduct(ID, payload);
    expect(supabase.rpc).toHaveBeenLastCalledWith('admin_save_product', {
      p_id: ID,
      p_payload: payload,
    });
  });

  it('throws a friendly message on failure', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'products_slug_key' },
    });
    await expect(saveProduct(null, {})).rejects.toThrow(/slug is already taken/);
  });
});

describe('setProductActive', () => {
  it('only flips is_active (soft delete) and never deletes rows', async () => {
    const query = fakeQuery({ data: [{ id: ID }], error: null });
    supabase.from.mockReturnValue(query);

    await setProductActive(ID, false);

    expect(supabase.from).toHaveBeenCalledWith('products');
    expect(callsOf(query, 'update')[0][1]).toEqual([{ is_active: false }]);
    expect(callsOf(query, 'eq')[0][1]).toEqual(['id', ID]);
    expect(callsOf(query, 'delete')).toHaveLength(0);
  });

  it('treats "no row updated" as a failure', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: [], error: null }));
    await expect(setProductActive(ID, true)).rejects.toThrow(/restore/);
    supabase.from.mockReturnValue(fakeQuery({ data: [], error: null }));
    await expect(setProductActive(ID, false)).rejects.toThrow(/deactivate/);
  });
});

describe('getAdminProduct', () => {
  it('maps a row to form values, keeping image order and local date text', async () => {
    supabase.from.mockReturnValue(
      fakeQuery({
        data: {
          id: ID,
          slug: 'earbuds',
          title: 'Earbuds',
          description: null,
          category_id: ID,
          price_minor: 1299,
          compare_at_price_minor: null,
          stock: 7,
          sizes: ['M'],
          colors: [{ name: 'Red', hex: '#FF0000' }],
          is_active: false,
          is_flash_deal: false,
          flash_ends_at: null,
          images: [
            { url: 'u2', public_id: 'p2', alt: null, position: 1 },
            { url: 'u1', public_id: 'p1', alt: 'front', position: 0 },
          ],
          product_deal_tags: [{ deal_tag_id: 'tag' }],
        },
        error: null,
      }),
    );

    expect(await getAdminProduct(ID)).toMatchObject({
      title: 'Earbuds',
      description: '',
      price: '12.99',
      compareAtPrice: '',
      stock: '7',
      isActive: false,
      flashEndsAt: '',
      dealTagIds: ['tag'],
      images: [
        { url: 'u1', publicId: 'p1', alt: 'front' },
        { url: 'u2', publicId: 'p2', alt: '' },
      ],
    });
  });

  it('returns null for a bad id without asking the database, and for a missing product', async () => {
    expect(await getAdminProduct('nope')).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();

    supabase.from.mockReturnValue(fakeQuery({ data: null, error: null }));
    expect(await getAdminProduct(ID)).toBeNull();
  });

  it('throws a friendly error when loading fails', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: null, error: { message: 'boom' } }));
    await expect(getAdminProduct(ID)).rejects.toThrow(/couldn.t load this product/i);
  });
});

describe('listAdminDealTags', () => {
  it('maps rows', async () => {
    supabase.from.mockReturnValue(
      fakeQuery({ data: [{ id: 't', name: 'N', is_active: true }], error: null }),
    );
    expect(await listAdminDealTags()).toEqual([{ id: 't', name: 'N', isActive: true }]);
  });
});

describe('category service', () => {
  it('inserts when there is no id and updates when there is one', async () => {
    const insert = fakeQuery({ data: [{ id: ID }], error: null });
    supabase.from.mockReturnValueOnce(insert);
    expect(await saveCategory(null, { name: 'N' })).toBe(ID);
    expect(callsOf(insert, 'insert')[0][1]).toEqual([{ name: 'N' }]);

    const update = fakeQuery({ data: [{ id: ID }], error: null });
    supabase.from.mockReturnValueOnce(update);
    await saveCategory(ID, { name: 'N2' });
    expect(callsOf(update, 'update')[0][1]).toEqual([{ name: 'N2' }]);
    expect(callsOf(update, 'eq')[0][1]).toEqual(['id', ID]);
  });

  it('reports a taken slug and a silently blocked write', async () => {
    supabase.from.mockReturnValueOnce(
      fakeQuery({ data: null, error: { code: '23505', message: 'categories_slug_key' } }),
    );
    await expect(saveCategory(null, {})).rejects.toThrow(/slug is already taken/);

    supabase.from.mockReturnValueOnce(fakeQuery({ data: [], error: null }));
    await expect(saveCategory(ID, {})).rejects.toThrow(/permission/);
  });

  it('soft-deletes by flipping is_active', async () => {
    const query = fakeQuery({ data: [{ id: ID }], error: null });
    supabase.from.mockReturnValue(query);
    await setCategoryActive(ID, false);
    expect(callsOf(query, 'update')[0][1]).toEqual([{ is_active: false }]);
    expect(callsOf(query, 'delete')).toHaveLength(0);
  });

  it('counts the live products in a category, or null if it cannot', async () => {
    supabase.from.mockReturnValueOnce(fakeQuery({ count: 4, error: null }));
    expect(await countActiveProductsInCategory(ID)).toBe(4);
    supabase.from.mockReturnValueOnce(fakeQuery({ count: null, error: { message: 'x' } }));
    expect(await countActiveProductsInCategory(ID)).toBeNull();
  });

  it('maps a category to form values, with the icon as a one-item list', async () => {
    supabase.from.mockReturnValue(
      fakeQuery({
        data: {
          id: ID,
          name: 'N',
          slug: 's',
          sort_order: 3,
          is_active: true,
          icon_url: 'u',
          icon_public_id: 'p',
        },
        error: null,
      }),
    );
    expect(await getAdminCategory(ID)).toEqual({
      name: 'N',
      slug: 's',
      sortOrder: '3',
      isActive: true,
      icon: [{ url: 'u', publicId: 'p', alt: '' }],
    });
  });
});

describe('uploadService', () => {
  const signature = {
    uploadUrl: 'https://api.cloudinary.com/v1_1/dk1jm0rwi/image/upload',
    apiKey: 'key',
    timestamp: 123,
    signature: 'sig',
    publicId: 'shopyaro/products/abc',
    assetFolder: 'shopyaro/products',
    allowedFormats: 'jpg,jpeg,png,webp',
  };
  const goodFile = { name: 'a.jpg', type: 'image/jpeg', size: 1000 };

  let lastRequest;
  function stubXhr({ status = 200, body } = {}) {
    lastRequest = null;
    class FakeXhr {
      constructor() {
        this.upload = {};
        lastRequest = this;
      }
      open(method, url) {
        this.method = method;
        this.url = url;
      }
      send(form) {
        this.form = form;
        queueMicrotask(() => {
          this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
          this.status = status;
          this.responseText = typeof body === 'string' ? body : JSON.stringify(body);
          this.onload();
        });
      }
      abort() {
        this.onabort?.();
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  }

  afterEach(() => vi.unstubAllGlobals());

  it('requests a signature for a folder', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: signature, error: null });
    expect(await requestUploadSignature('products')).toEqual(signature);
    expect(supabase.functions.invoke).toHaveBeenCalledWith('sign-upload', {
      body: { folder: 'products' },
    });
  });

  it('fails clearly when the signature cannot be obtained', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { message: 'Not allowed' } });
    await expect(requestUploadSignature('products')).rejects.toThrow(/could not start the upload/i);
    supabase.functions.invoke.mockResolvedValue({ data: { signature: 'x' }, error: null });
    await expect(requestUploadSignature('products')).rejects.toThrow(/could not start the upload/i);
  });

  it('uploads straight to Cloudinary with the signed fields and reports progress', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: signature, error: null });
    stubXhr({
      body: {
        secure_url:
          'https://res.cloudinary.com/dk1jm0rwi/image/upload/v1/shopyaro/products/abc.jpg',
        public_id: 'shopyaro/products/abc',
      },
    });
    const onProgress = vi.fn();

    const result = await uploadImage(goodFile, 'products', { onProgress });

    expect(result).toEqual({
      url: 'https://res.cloudinary.com/dk1jm0rwi/image/upload/v1/shopyaro/products/abc.jpg',
      publicId: 'shopyaro/products/abc',
    });
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(lastRequest.method).toBe('POST');
    expect(lastRequest.url).toBe(signature.uploadUrl);
    expect(lastRequest.form.get('signature')).toBe('sig');
    expect(lastRequest.form.get('public_id')).toBe('shopyaro/products/abc');
    expect(lastRequest.form.get('api_key')).toBe('key');
    // The API secret is never part of the request.
    expect([...lastRequest.form.keys()]).not.toContain('api_secret');
  });

  it('rejects a bad file before asking for a signature', async () => {
    await expect(
      uploadImage({ name: 'a.gif', type: 'image/gif', size: 5 }, 'products'),
    ).rejects.toThrow(/only JPG, PNG or WebP/);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('fails when Cloudinary errors or returns something unexpected', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: signature, error: null });

    stubXhr({ status: 400, body: { error: { message: 'bad' } } });
    await expect(uploadImage(goodFile, 'products')).rejects.toThrow(/upload failed/i);

    stubXhr({
      body: { secure_url: 'https://evil.example/a.jpg', public_id: 'shopyaro/products/abc' },
    });
    await expect(uploadImage(goodFile, 'products')).rejects.toThrow(/upload failed/i);

    stubXhr({
      body: {
        secure_url: 'https://res.cloudinary.com/dk1jm0rwi/image/upload/v1/x.jpg',
        public_id: 'something/else',
      },
    });
    await expect(uploadImage(goodFile, 'products')).rejects.toThrow(/upload failed/i);

    stubXhr({ body: 'not json' });
    await expect(uploadImage(goodFile, 'products')).rejects.toThrow(/upload failed/i);
  });
});
