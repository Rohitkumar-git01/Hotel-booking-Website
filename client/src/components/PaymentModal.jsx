import React, { useState } from "react";

const PaymentModal = ({ isOpen, onClose, bookingDetails, onConfirmPayment }) => {
  const [selectedMethod, setSelectedMethod] = useState("PhonePe");
  const [upiId, setUpiId] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [cardData, setCardData] = useState({
    number: "",
    expiry: "",
    cvv: "",
    name: "",
  });
  const [selectedBank, setSelectedBank] = useState("SBI");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [txnId, setTxnId] = useState("");

  if (!isOpen) return null;

  const { hotelName, roomType, totalPrice, checkInDate, checkOutDate } = bookingDetails || {};

  const handlePay = async () => {
    setProcessing(true);
    // Simulate real payment gateway processing delay
    setTimeout(async () => {
      const generatedTxn = "TXN" + Math.floor(100000000 + Math.random() * 900000000);
      setTxnId(generatedTxn);
      setProcessing(false);
      setSuccess(true);

      setTimeout(async () => {
        await onConfirmPayment(selectedMethod, generatedTxn);
        setSuccess(false);
        onClose();
      }, 1500);
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transition-all transform animate-fadeIn">

        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6 relative">
          <button
            onClick={onClose}
            disabled={processing}
            className="absolute top-5 right-5 text-gray-400 hover:text-white transition-all cursor-pointer text-xl font-bold"
          >
            ✕
          </button>
          <p className="text-xs uppercase tracking-wider text-orange-400 font-semibold">Fast & Secure Payment</p>
          <h2 className="text-2xl font-bold font-playfair mt-1">Select Payment Method</h2>

          {/* Order Summary Pill */}
          <div className="mt-4 bg-white/10 backdrop-blur-md rounded-xl p-3.5 flex justify-between items-center text-sm border border-white/10">
            <div>
              <p className="font-semibold text-white">{hotelName || "Hotel Booking"}</p>
              <p className="text-xs text-gray-300">{roomType ? `${roomType} • ` : ""}{checkInDate ? `${checkInDate} to ${checkOutDate}` : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-300">Total Amount</p>
              <p className="text-xl font-bold text-orange-400">${totalPrice || 0}</p>
            </div>
          </div>
        </div>

        {/* Processing or Success View */}
        {processing ? (
          <div className="py-16 px-6 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-semibold text-gray-800">Processing Payment via {selectedMethod}...</p>
            <p className="text-xs text-gray-500">Please do not refresh or close this window.</p>
          </div>
        ) : success ? (
          <div className="py-12 px-6 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center text-3xl font-bold shadow-lg animate-bounce">
              ✓
            </div>
            <h3 className="text-2xl font-bold text-gray-800">Payment Successful!</h3>
            <p className="text-sm text-gray-600">Transaction ID: <span className="font-mono font-semibold text-gray-900">{txnId}</span></p>
            <p className="text-xs text-green-600 font-medium">Your room booking is confirmed!</p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Payment Method Selector Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

              {/* PhonePe */}
              <button
                type="button"
                onClick={() => { setSelectedMethod("PhonePe"); setShowQr(false); }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${selectedMethod === "PhonePe"
                  ? "border-purple-600 bg-purple-50 ring-2 ring-purple-500/20"
                  : "border-gray-200 hover:border-purple-300"
                  }`}
              >
                <div className="w-10 h-10 rounded-full bg-purple-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  Pe
                </div>
                <span className="text-xs font-semibold mt-2 text-gray-800">PhonePe</span>
                <span className="text-[10px] text-purple-600 font-medium">UPI / Instant</span>
              </button>

              {/* Google Pay */}
              <button
                type="button"
                onClick={() => { setSelectedMethod("Google Pay"); setShowQr(false); }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${selectedMethod === "Google Pay"
                  ? "border-blue-600 bg-blue-50 ring-2 ring-blue-500/20"
                  : "border-gray-200 hover:border-blue-300"
                  }`}
              >
                <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                  <span className="font-bold text-sm bg-gradient-to-r from-blue-500 via-red-500 to-green-500 bg-clip-text text-transparent">GPay</span>
                </div>
                <span className="text-xs font-semibold mt-2 text-gray-800">Google Pay</span>
                <span className="text-[10px] text-blue-600 font-medium">UPI Payment</span>
              </button>

              {/* Paytm */}
              <button
                type="button"
                onClick={() => { setSelectedMethod("Paytm"); setShowQr(false); }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${selectedMethod === "Paytm"
                  ? "border-cyan-600 bg-cyan-50 ring-2 ring-cyan-500/20"
                  : "border-gray-200 hover:border-cyan-300"
                  }`}
              >
                <div className="w-10 h-10 rounded-full bg-sky-950 text-cyan-400 flex items-center justify-center font-black text-xs shadow-sm">
                  Paytm
                </div>
                <span className="text-xs font-semibold mt-2 text-gray-800">Paytm</span>
                <span className="text-[10px] text-cyan-700 font-medium">UPI / Wallet</span>
              </button>

              {/* Credit / Debit Card */}
              <button
                type="button"
                onClick={() => setSelectedMethod("Card")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${selectedMethod === "Card"
                  ? "border-orange-600 bg-orange-50 ring-2 ring-orange-500/20"
                  : "border-gray-200 hover:border-orange-300"
                  }`}
              >
                <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg shadow-sm">
                  💳
                </div>
                <span className="text-xs font-semibold mt-2 text-gray-800">Card</span>
                <span className="text-[10px] text-gray-500 font-medium">Credit/Debit</span>
              </button>

              {/* Net Banking */}
              <button
                type="button"
                onClick={() => setSelectedMethod("Net Banking")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${selectedMethod === "Net Banking"
                  ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20"
                  : "border-gray-200 hover:border-emerald-300"
                  }`}
              >
                <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center text-lg shadow-sm">
                  🏦
                </div>
                <span className="text-xs font-semibold mt-2 text-gray-800">Net Banking</span>
                <span className="text-[10px] text-emerald-700 font-medium">All Banks</span>
              </button>

              {/* Pay At Hotel */}
              <button
                type="button"
                onClick={() => setSelectedMethod("Pay At Hotel")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${selectedMethod === "Pay At Hotel"
                  ? "border-amber-600 bg-amber-50 ring-2 ring-amber-500/20"
                  : "border-gray-200 hover:border-amber-300"
                  }`}
              >
                <div className="w-10 h-10 rounded-full bg-amber-600 text-white flex items-center justify-center text-lg shadow-sm">
                  🏨
                </div>
                <span className="text-xs font-semibold mt-2 text-gray-800">Pay At Hotel</span>
                <span className="text-[10px] text-amber-700 font-medium">Cash / Desk</span>
              </button>
            </div>

            {/* Sub-form based on selected method */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">

              {/* PhonePe / Google Pay / Paytm Options */}
              {["PhonePe", "Google Pay", "Paytm"].includes(selectedMethod) && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-700">
                      Enter {selectedMethod} UPI ID / Mobile Number
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowQr(!showQr)}
                      className="text-xs text-purple-600 hover:underline font-medium cursor-pointer"
                    >
                      {showQr ? "Hide QR" : "Show QR Code"}
                    </button>
                  </div>

                  {!showQr ? (
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={
                          selectedMethod === "PhonePe"
                            ? "e.g. 9876543210@ybl"
                            : selectedMethod === "Google Pay"
                              ? "e.g. user@okaxis"
                              : "e.g. 9876543210@paytm"
                        }
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm outline-none focus:border-purple-500"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">
                        VERIFIED UPI
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center bg-white p-4 rounded-lg border border-dashed border-purple-300">
                      {/* Stylized QR Code graphics */}
                      <div className="w-36 h-36 bg-gray-900 p-2 rounded-lg relative flex items-center justify-center">
                        <div className="w-full h-full bg-white p-2.5 grid grid-cols-5 grid-rows-5 gap-1 rounded">
                          <div className="bg-gray-900 col-span-2 row-span-2 rounded-sm"></div>
                          <div className="bg-purple-600 col-span-1"></div>
                          <div className="bg-gray-900 col-span-2 row-span-2 rounded-sm"></div>
                          <div className="bg-purple-600 row-span-2"></div>
                          <div className="bg-gray-900 col-span-1"></div>
                          <div className="bg-purple-600 col-span-2"></div>
                          <div className="bg-gray-900 col-span-2 row-span-2 rounded-sm"></div>
                          <div className="bg-purple-600 col-span-1"></div>
                          <div className="bg-gray-900 col-span-2"></div>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-gray-700 mt-2">Scan & Pay using any UPI app</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <span className="text-green-600">✓</span> 100% Encrypted & Instant Payment Confirmation
                  </div>
                </div>
              )}

              {/* Card Form */}
              {selectedMethod === "Card" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Card Number</label>
                    <input
                      type="text"
                      placeholder="4532 •••• •••• 8921"
                      maxLength={19}
                      value={cardData.number}
                      onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm outline-none focus:border-orange-500 mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700">Expiry Date</label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        maxLength={5}
                        value={cardData.expiry}
                        onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm outline-none focus:border-orange-500 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700">CVV</label>
                      <input
                        type="password"
                        placeholder="123"
                        maxLength={4}
                        value={cardData.cvv}
                        onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm outline-none focus:border-orange-500 mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Net Banking Form */}
              {selectedMethod === "Net Banking" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700">Select Bank</label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="SBI">State Bank of India (SBI)</option>
                    <option value="HDFC">HDFC Bank</option>
                    <option value="ICICI">ICICI Bank</option>
                    <option value="AXIS">Axis Bank</option>
                    <option value="KOTAK">Kotak Mahindra Bank</option>
                  </select>
                </div>
              )}

              {/* Pay At Hotel Notice */}
              {selectedMethod === "Pay At Hotel" && (
                <div className="text-xs text-gray-600 space-y-1">
                  <p className="font-semibold text-gray-800">Pay directly at hotel reception</p>
                  <p>You can pay via Cash, Card, or UPI when checking into your room.</p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={handlePay}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold py-3.5 rounded-xl shadow-lg hover:shadow-orange-500/25 transition-all cursor-pointer text-base active:scale-[0.99]"
            >
              {selectedMethod === "Pay At Hotel"
                ? "Confirm Booking (Pay At Hotel)"
                : `Pay $${totalPrice || 0} via ${selectedMethod}`}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default PaymentModal;
