// 文件名：src/utils/webdavUtils.ts
import { R2Object } from '@cloudflare/workers-types';
import { WebDAVProps } from '../types';

export function make_resource_path(request: Request): string {
	const url = new URL(request.url);
	const normalized = url.pathname.replace(/\/+/g, '/'); // 合并重复斜杠，避免 "//file" 导致路径解析异常
	const sliced = normalized.slice(1); // 去掉开头的斜杠
	// 若 Worker 挂载在 /webdav 子路径，去掉该前缀以匹配 R2 的实际对象键
	const withoutPrefix = sliced.startsWith('webdav/')
		? sliced.slice('webdav/'.length)
		: sliced === 'webdav'
			? ''
			: sliced;
	return decodeURIComponent(withoutPrefix);
}

export async function* listAll(bucket: R2Bucket, prefix: string) {
	const options = { prefix, delimiter: '/' };
	let result = await bucket.list(options);

	while (result.objects.length > 0) {
		for (const object of result.objects) {
			yield object;
		}

		if (result.truncated && result.cursor) {
			result = await bucket.list({ ...options, cursor: result.cursor });
		} else {
			break;
		}
	}
}

export function fromR2Object(object: R2Object | null): WebDAVProps {
	if (!object) {
		return {
			creationdate: new Date().toUTCString(),
			displayname: undefined,
			getcontentlanguage: undefined,
			getcontentlength: '0',
			getcontenttype: undefined,
			getetag: undefined,
			getlastmodified: new Date().toUTCString(),
			resourcetype: 'collection',
		};
	}
	return {
		creationdate: object.uploaded.toUTCString(),
		displayname: object.key.split('/').pop(),
		getcontentlanguage: object.httpMetadata?.contentLanguage,
		getcontentlength: object.size.toString(),
		getcontenttype: object.httpMetadata?.contentType,
		getetag: object.etag,
		getlastmodified: object.uploaded.toUTCString(),
		resourcetype: object.customMetadata?.resourcetype || '',
	};
}

export function generatePropfindResponse(bucketName: string, basePath: string, props: WebDAVProps[]): string {
	const responses = props.map((prop) => generatePropResponse(bucketName, basePath, prop)).join('\n');
	return `<?xml version="1.0" encoding="utf-8" ?>
  <D:multistatus xmlns:D="DAV:">
${responses}
  </D:multistatus>`;
}

function generatePropResponse(bucketName: string, basePath: string, prop: WebDAVProps): string {
	// 规范化路径，避免出现多余的斜杠导致客户端发起 // 路径
	const parts = [bucketName, basePath, prop.displayname || ''].filter((p) => p !== undefined);
	const resourcePath =
		'/' +
		parts
			.join('/')
			.replace(/\/+/g, '/')
			.replace(/\/$/, prop.resourcetype ? '/' : '');
	return `  <D:response>
    <D:href>${resourcePath}</D:href>
    <D:propstat>
      <D:prop>
        <D:creationdate>${prop.creationdate}</D:creationdate>
        <D:getcontentlength>${prop.getcontentlength}</D:getcontentlength>
        <D:getcontenttype>${prop.getcontenttype || ''}</D:getcontenttype>
        <D:getetag>${prop.getetag || ''}</D:getetag>
        <D:getlastmodified>${prop.getlastmodified}</D:getlastmodified>
        <D:resourcetype>${prop.resourcetype ? '<D:collection/>' : ''}</D:resourcetype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
}
