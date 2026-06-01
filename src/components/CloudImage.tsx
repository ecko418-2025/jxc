import React, { useState, useEffect } from 'react';
import { Image } from 'antd';
import { tcbApp } from '../database/db';

interface CloudImageProps {
  src?: string;
  alt?: string;
  style?: React.CSSProperties;
  preview?: boolean;
}

export const CloudImage: React.FC<CloudImageProps> = ({ src, alt, style, preview = true }) => {
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    if (!src) {
      setUrl('');
      return;
    }
    
    let fileIdToFetch = src;

    // 如果已经是正常的 http/https URL
    if (src.startsWith('http')) {
      // 兼容处理：如果数据库中存的是旧的、带签名的 tcb.qcloud.la 过期链接
      // 我们将其转换回 cloud:// 格式重新拉取
      if (src.includes('tcb.qcloud.la') || src.includes('myqcloud.com')) {
        try {
          const urlObj = new URL(src);
          // urlObj.hostname 例如: 6373-cshj001-d7g5f1k0tc94d4181-1428383052.tcb.qcloud.la
          const bucket = urlObj.hostname.split('.')[0];
          const env = 'cshj001-d7g5f1k0tc94d4181';
          const path = urlObj.pathname.replace(/^\//, ''); // 移除开头的斜杠
          fileIdToFetch = `cloud://${env}.${bucket}/${path}`;
        } catch(e) {
          setUrl(src);
          return;
        }
      } else {
        setUrl(src);
        return;
      }
    }

    // 如果是腾讯云的 cloud:// ID，动态换取一次性临时链接
    if (fileIdToFetch.startsWith('cloud://')) {
      tcbApp.getTempFileURL({ fileList: [fileIdToFetch] })
        .then(res => {
          if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
            setUrl(res.fileList[0].tempFileURL);
          }
        })
        .catch(err => {
          console.error('Failed to get temp file URL:', err);
        });
    } else {
      setUrl(fileIdToFetch);
    }
  }, [src]);

  if (!url) {
    return <div style={{ ...style, background: '#334155' }} />;
  }

  return (
    <div style={{ display: 'inline-block', lineHeight: 0 }} onClick={(e) => preview && e.stopPropagation()}>
      <Image src={url} alt={alt || 'img'} style={style} preview={preview} />
    </div>
  );
};
