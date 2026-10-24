import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, CheckCircle2, MessageSquare, ImagePlus, X } from 'lucide-react';

export default function ProductReviewsSection({ productId, isLoggedIn, reviews = [] }) {
  const navigate = useNavigate();

  // Review List State
  const [reviewList, setReviewList] = useState(reviews);

  // Form State
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewImage, setReviewImage] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  // Handle Image Upload & Preview
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setReviewImage(imageUrl);
    }
  };

  const handleRemoveImage = () => {
    setReviewImage(null);
  };

  const handleSubmitReview = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const newEntry = {
      id: `rev-${Date.now()}`,
      userName: 'Huzaifa Javid',
      rating: newRating,
      date: 'Just now',
      comment: newComment.trim(),
      image: reviewImage,
      verifiedPurchase: true,
    };

    setReviewList([newEntry, ...reviewList]);
    setNewComment('');
    setNewRating(5);
    setReviewImage(null);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const averageRating = reviewList.length > 0
    ? (reviewList.reduce((acc, item) => acc + item.rating, 0) / reviewList.length).toFixed(1)
    : '0.0';

  return (
    <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-6 shadow-xs font-sans">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-blue-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900">
            Customer Reviews ({reviewList.length})
          </h2>
        </div>

        {reviewList.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            <span className="text-gray-900 font-bold">{averageRating}</span>
            <span className="text-gray-400 font-normal">/ 5.0</span>
          </div>
        )}
      </div>

      {/* Review Write Form / Auth Guard */}
      <div className="py-5 border-b border-gray-100">
        {isLoggedIn ? (
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-gray-900">Write a Review</span>

              {/* Interactive Star Picker */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 mr-1">Your Rating:</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-0.5 text-amber-400 transition cursor-pointer"
                  >
                    <Star
                      size={16}
                      className={
                        star <= (hoverRating || newRating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-gray-300'
                      }
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Comment Area */}
            <textarea
              rows="3"
              required
              placeholder="Share your honest feedback regarding quality, packaging, and delivery..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 outline-none focus:bg-white focus:border-blue-600 transition resize-none"
            />

            {/* Optional Image Attachment Control */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div>
                {!reviewImage ? (
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer">
                    <ImagePlus size={14} className="text-blue-600" />
                    <span>Add Photo (Optional)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative inline-block">
                    <img
                      src={reviewImage}
                      alt="Review attachment preview"
                      className="w-14 h-14 object-cover rounded-xl border border-gray-200 p-0.5 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition cursor-pointer shadow-xs"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {submitted ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <CheckCircle2 size={14} />
                    <span>Review published!</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-gray-400 hidden sm:inline">
                    Posting as <strong className="text-gray-700 font-bold">Huzaifa Javid</strong>
                  </span>
                )}

                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer active:scale-95"
                >
                  Submit Review
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between py-1 text-xs">
            <span className="text-gray-500">Have you purchased this item?</span>
            <button
              onClick={() => navigate('/login?redirect=shipping')}
              className="text-blue-600 hover:text-blue-700 font-bold transition cursor-pointer"
            >
              Sign In to Write a Review
            </button>
          </div>
        )}
      </div>

      {/* Reviews List Feed */}
      <div className="divide-y divide-gray-100">
        {reviewList.length > 0 ? (
          reviewList.map((item) => (
            <div key={item.id} className="py-4 first:pt-2">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900">{item.userName}</span>
                  {item.verifiedPurchase && (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                      <CheckCircle2 size={11} /> Verified Buyer
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-gray-400">{item.date}</span>
              </div>

              {/* Rating Stars */}
              <div className="flex items-center text-amber-400 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={12}
                    className={i < item.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
                  />
                ))}
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">{item.comment}</p>

              {/* Review Photo (If user attached one) */}
              {item.image && (
                <div className="mt-2.5">
                  <img
                    src={item.image}
                    alt="Customer attachment"
                    className="w-16 h-16 object-cover rounded-xl border border-gray-200 p-0.5 bg-gray-50"
                  />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-xs text-gray-400">
            No customer reviews yet. Be the first to write a review for this product!
          </div>
        )}
      </div>

    </div>
  );
}

