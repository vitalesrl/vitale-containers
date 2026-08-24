"use client";

import { useState } from "react";
import type { MediaAsset } from "@/lib/types";

export function ProductGallery({ images, fallbackUrl, title, size, type }: { images: MediaAsset[]; fallbackUrl?: string | null; title: string; size: string; type: string }) {
  const urls = images.length ? images.map((image) => ({ id: image.id, url: image.url, alt: image.originalName })) : fallbackUrl ? [{ id: "legacy", url: fallbackUrl, alt: title }] : [];
  const [selected, setSelected] = useState(0);

  if (!urls.length) {
    return <div className="detail-image"><div className="container-glyph large" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><span>{size}</span><small>{type}</small></div>;
  }

  const active = urls[Math.min(selected, urls.length - 1)];
  return (
    <div className="product-gallery">
      <div className="detail-image has-photo gallery-main"><img className="product-photo detail-photo" src={active.url} alt={title} /></div>
      {urls.length > 1 && <div className="gallery-thumbs">{urls.map((image, index) => <button type="button" className={index === selected ? "active" : ""} key={image.id} onClick={() => setSelected(index)}><img src={image.url} alt={`${title} - foto ${index + 1}`} /></button>)}</div>}
    </div>
  );
}
