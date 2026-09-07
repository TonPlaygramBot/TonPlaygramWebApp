import React from 'react';
import { REVIEW_SECONDS, type Review } from '../../../../shared/tennis/court';

export function LineReview({ review, time }: { review: Review; time: number }) {
  const elapsed = time - review.startedAt,
    verdict = elapsed >= 2.6;
  const millimetres = Math.round(Math.abs(review.call.margin) * 1000);
  return (
    <div className="tr-review" aria-label="Line call replay">
      <div className="tr-review-label">
        <span /> LINE REVIEW <b>{verdict ? 'BALL MARK' : 'SLOW MOTION'}</b>
      </div>
      <div className="tr-review-verdict" role="status" aria-live="polite">
        <small>{review.call.line}</small>
        <strong className={review.call.in ? 'tr-review-in' : 'tr-review-out'}>
          {verdict ? (review.call.in ? 'IN' : 'OUT') : 'REPLAY'}
        </strong>
        <p>
          {verdict
            ? millimetres === 0
              ? review.call.in
                ? 'Touching the line'
                : 'Less than 1 mm outside'
              : `${millimetres} mm ${review.call.in ? 'inside' : 'outside'}`
            : 'Tracking the bounce'}
        </p>
        <div className="tr-review-progress">
          <i
            style={{
              width: `${Math.min(100, (elapsed / REVIEW_SECONDS) * 100)}%`
            }}
          />
        </div>
      </div>
    </div>
  );
}
