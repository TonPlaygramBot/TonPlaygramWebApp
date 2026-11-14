# Tirana Streets uniform markings

The existing original GLBs remain the source for meshes, rigs, fabric maps,
equipment and lettering. This update corrects two visible material problems:

- Shqiponja's repeated red/silver horizontal shin bands become navy, retaining
  the red upper garment. This uses the red/navy service variant with plain dark
  trousers, rather than approximating the separate motorcycle suit's narrow
  longitudinal reflective panels with wide rings around each leg.
- Shqiponja, FNSH and RENEA name strips and their backings use a matte fabric
  response. Their exporter had assigned metallic car-paint material properties.

The correction runs once per loaded template, before LOD preparation. The new
lower-leg vertex colour is inherited by the reduced index-buffer LOD. No extra
meshes, draw calls, downloads or per-frame shader callbacks are introduced.
Positions, normals, UVs, skin weights, animation clips and original GLB bytes
are unchanged. Existing cloth normal and roughness maps are retained.

## Visual references

Photographs were inspected for appearance only; no photograph is redistributed
as a texture and no permission to reuse these photographs is claimed.

| Reference | Visible feature |
| --- | --- |
| [Albanian State Police, Kukës unit introduction, 11 September 2020](https://asp.gov.al/kukes-prezantohet-forca-e-posacme-shqiponjat-e-dvp-kukes/) | Dark service clothing and small chest/sleeve insignia; evidence that there are multiple uniform variants. |
| [Shqiponja formation photograph, cited in the original asset pack](https://shqiptarja.com/uploads/ckeditor/64747ae22adf85-1.jpg) | Red/navy upper garments, dark trousers and cloth unit labels. |
| [Shqiponja motorcycle photograph, cited in the original asset pack](https://shqiptarja.com/uploads/780x440/1601562289_shwqifd.png) | Narrow vertical outer-leg and forearm reflective/red panels; not broad horizontal rings. |
| [FNSH uniform photograph from the vehicle handover](https://shqiptarja.com/uploads/1583505112_1015.jpg) | Navy fabric, black vest, white FNSH lettering on a dark fabric strip. |
| [Albanian State Police, RENEA equipment handover, 16 February 2022](https://asp.gov.al/policia-federale-gjermane-donacion-per-repartin-special-renea/) | Dark uniforms with small pale labels, rather than metallic lettering. |

These are corrections to the existing service-uniform rendition, not a claim
that the models reproduce every current insignia or every unit's uniform.
