"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { applicationSchema, ApplicationFormData } from "@/lib/validations/application";
import { Loader2 } from "lucide-react";
import { trackStepComplete, trackPaymentSuccess } from "@/lib/analytics";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const steps = [
  "Program",
  "Student Information",
  "Guardian",
  "Contact",
  "Address",
  "Education",
  "Review & Payment"
];

export default function ApplicationWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [otpStep, setOtpStep] = useState<"idle" | "sending" | "sent" | "verifying" | "verified" | "processing_payment">("idle");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const { register, handleSubmit, formState: { errors }, watch, trigger, reset, setValue } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      program: "EGX 100", // Default or load from local storage
    }
  });

  const program = watch("program");
  const highestQualification = watch("highestQualification");

  useEffect(() => {
    try {
      const savedData = localStorage.getItem("edex_application_draft");
      if (savedData) {
        reset(JSON.parse(savedData));
      }
      const savedStep = localStorage.getItem("edex_application_step");
      if (savedStep) {
        setCurrentStep(parseInt(savedStep, 10));
      }
    } catch (e) {
      console.error("localStorage access denied");
    }
  }, [reset]);

  const nextStep = async () => {
    let fieldsToValidate: any[] = [];
    
    switch(currentStep) {
      case 0: fieldsToValidate = ['program']; break;
      case 1: fieldsToValidate = ['firstName', 'lastName', 'dob', 'gender']; break;
      case 2: fieldsToValidate = ['guardianName', 'guardianContact']; break;
      case 3: fieldsToValidate = ['mobile', 'secondMobile', 'email']; break;
      case 4: fieldsToValidate = ['houseName', 'area', 'postOffice', 'district', 'state', 'pincode']; break;
      case 5: fieldsToValidate = ['highestQualification', 'customQualification']; break;
    }

    const isStepValid = await trigger(fieldsToValidate as any);
    
    if (isStepValid) {
      const currentData = watch();
      localStorage.setItem("edex_application_draft", JSON.stringify(currentData));
      const nextStepIndex = currentStep + 1;
      localStorage.setItem("edex_application_step", nextStepIndex.toString());
      trackStepComplete(steps[currentStep], currentStep, currentData.program);
      setCurrentStep(nextStepIndex);
    }
  };

  const prevStep = () => {
    const prevStepIndex = currentStep - 1;
    localStorage.setItem("edex_application_step", prevStepIndex.toString());
    setCurrentStep(prevStepIndex);
  };

  const onSubmit = async (data: ApplicationFormData) => {
    if (otpStep === "idle" || otpStep === "sending") {
      setOtpStep("sending");
      setOtpError("");
      try {
        const res = await fetch("/api/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email,
            name: `${data.firstName} ${data.lastName}`,
            program: data.program,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to send OTP");
        setOtpStep("sent");
      } catch (err: any) {
        setOtpError(err.message);
        setOtpStep("idle");
      }
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setOtpError("OTP must be 6 digits");
      return;
    }
    setOtpStep("verifying");
    setOtpError("");
    try {
      const data = watch();
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, otp }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Invalid OTP");
      
      setOtpStep("verified");
      await initiatePayment(data);
    } catch (err: any) {
      setOtpError(err.message);
      setOtpStep("sent");
    }
  };

  const initiatePayment = async (data: ApplicationFormData) => {
    setOtpStep("processing_payment");
    setPaymentError("");
    try {
      // 1. Load Razorpay script
      const resLoad = await new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
      if (!resLoad) throw new Error("Razorpay SDK failed to load");

      // 2. Create order
      const resOrder = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const orderData = await resOrder.json();
      if (!resOrder.ok) throw new Error(orderData.error || "Failed to create order");

      // 3. Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "EDEX Life School",
        description: `Application Fee - ${data.program}`,
        order_id: orderData.orderId,
        config: {
          display: {
            blocks: {
              upi: {
                name: "Pay via UPI (GPay, PhonePe, Paytm)",
                instruments: [
                  { method: "upi" }
                ],
              },
              other: {
                name: "Other Payment Modes",
                instruments: [
                  { method: "card" },
                  { method: "netbanking" },
                  { method: "wallet" }
                ]
              }
            },
            sequence: ["block.upi", "block.other"],
            preferences: {
              show_default_blocks: false,
            }
          }
        },
        handler: async function (response: any) {
          try {
            const resVerify = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                applicationId: orderData.applicationId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            const verifyData = await resVerify.json();
            if (!resVerify.ok) throw new Error(verifyData.error || "Payment verification failed");

            // Track successful payment
            trackPaymentSuccess(data.program);

            // Redirect to confirm
            sessionStorage.setItem("edex_confirmation", JSON.stringify({
              applicationId: orderData.applicationId,
              program: data.program,
              applicantName: `${data.firstName} ${data.lastName}`,
              email: data.email,
              receiptNumber: "Generated shortly", // Will be available in PDF
              paidAt: new Date().toISOString(),
            }));
            window.location.href = "/confirm";
          } catch (err: any) {
            setPaymentError(err.message || "Payment verification failed");
            setOtpStep("verified");
          }
        },
        prefill: {
          name: `${data.firstName} ${data.lastName}`,
          email: data.email,
          contact: data.mobile,
        },
        theme: {
          color: "#161616",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        setPaymentError(response.error.description || "Payment failed");
        setOtpStep("verified");
      });
      rzp.open();

    } catch (err: any) {
      setPaymentError(err.message);
      setOtpStep("verified"); // Allow retry
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 pt-24">
      {/* Progress Bar */}
      <div className="mb-12">
        <div className="flex justify-between mb-2">
          {steps.map((s, i) => (
            <div key={s} className={`text-sm font-bold ${i <= currentStep ? 'text-edex-neon' : 'text-edex-white/30'}`}>
              {i + 1}
            </div>
          ))}
        </div>
        <div className="w-full bg-edex-white/10 h-2 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-edex-neon"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{steps[currentStep]}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit, (errs) => console.error("Form Validation Errors:", errs))}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {currentStep === 0 && (
              <div className="space-y-4">
                <label className="block p-4 border border-edex-white/20 rounded-lg cursor-pointer hover:border-edex-neon">
                  <input type="radio" value="EGX 100" {...register("program")} className="mr-4" />
                  <span className="font-bold text-xl">EGX 100</span>
                </label>
                <label className="block p-4 border border-edex-white/20 rounded-lg cursor-pointer hover:border-edex-neon">
                  <input type="radio" value="EDEX Next" {...register("program")} className="mr-4" />
                  <span className="font-bold text-xl">EDEX Next</span>
                </label>
                {errors.program && <p className="text-red-500">{errors.program.message}</p>}
              </div>
            )}

            {currentStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">First Name</label>
                  <input type="text" {...register("firstName")} className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none" />
                  {errors.firstName && <p className="text-red-500 mt-1 text-sm">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">Last Name</label>
                  <input type="text" {...register("lastName")} className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none" />
                  {errors.lastName && <p className="text-red-500 mt-1 text-sm">{errors.lastName.message}</p>}
                </div>
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">Date of Birth</label>
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      placeholder="DD-MM-YYYY" 
                      {...register("dob", {
                        onChange: (e) => {
                          let val = e.target.value;
                          if (val.endsWith('-')) return; 
                          const raw = val.replace(/\D/g, "");
                          if (raw.length > 8) val = raw.slice(0, 8);
                          if (raw.length >= 5) {
                            val = `${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(4)}`;
                          } else if (raw.length >= 3) {
                            val = `${raw.slice(0, 2)}-${raw.slice(2)}`;
                          } else {
                            val = raw;
                          }
                          e.target.value = val;
                        }
                      })} 
                      maxLength={10}
                      className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none text-white [color-scheme:dark]" 
                    />
                    <div className="absolute right-3 w-8 h-8 cursor-pointer">
                      <DatePicker
                        selected={(() => {
                          const val = watch("dob") || "";
                          if (val.length === 10) {
                            const parts = val.split('-');
                            if (parts.length === 3) {
                              const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                              if (!isNaN(d.getTime())) return d;
                            }
                          }
                          return null;
                        })()}
                        onChange={(date) => {
                          if (date) {
                            const dd = String(date.getDate()).padStart(2, '0');
                            const mm = String(date.getMonth() + 1).padStart(2, '0');
                            const yyyy = date.getFullYear();
                            setValue("dob", `${dd}-${mm}-${yyyy}`, { shouldValidate: true });
                          }
                        }}
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        todayButton="Today"
                        popperPlacement="bottom-end"
                        customInput={<input className="w-8 h-8 opacity-0 cursor-pointer absolute z-10 right-0 top-0" />}
                      />
                      <svg className="absolute inset-0 m-auto w-6 h-6 text-edex-white/50 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  {errors.dob && <p className="text-red-500 mt-1 text-sm">{errors.dob.message}</p>}
                </div>
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">Gender</label>
                  <select {...register("gender")} className="w-full p-4 bg-edex-charcoal border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none text-white">
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender && <p className="text-red-500 mt-1 text-sm">{errors.gender.message}</p>}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">Guardian Name</label>
                  <input type="text" {...register("guardianName")} className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none" />
                  {errors.guardianName && <p className="text-red-500 mt-1 text-sm">{errors.guardianName.message}</p>}
                </div>
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">Guardian Contact Number</label>
                  <input type="tel" {...register("guardianContact")} placeholder="10 digits" className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none" />
                  {errors.guardianContact && <p className="text-red-500 mt-1 text-sm">{errors.guardianContact.message}</p>}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">Mobile Number</label>
                  <input type="tel" {...register("mobile")} placeholder="10 digits" className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none" />
                  {errors.mobile && <p className="text-red-500 mt-1 text-sm">{errors.mobile.message}</p>}
                </div>
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">Second Mobile (Optional)</label>
                  <input type="tel" {...register("secondMobile")} placeholder="10 digits" className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none" />
                  {errors.secondMobile && <p className="text-red-500 mt-1 text-sm">{errors.secondMobile.message}</p>}
                </div>
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">Email Address</label>
                  <input type="email" {...register("email")} className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none" />
                  {errors.email && <p className="text-red-500 mt-1 text-sm">{errors.email.message}</p>}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm mb-2 text-edex-white/70">House Name</label>
                  <input type="text" {...register("houseName")} className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none" />
                  {errors.houseName && <p className="text-red-500 mt-1 text-sm">{errors.houseName.message}</p>}
                </div>
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">Area</label>
                  <input type="text" {...register("area")} className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none" />
                  {errors.area && <p className="text-red-500 mt-1 text-sm">{errors.area.message}</p>}
                </div>
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">Post Office</label>
                  <input type="text" {...register("postOffice")} className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none" />
                  {errors.postOffice && <p className="text-red-500 mt-1 text-sm">{errors.postOffice.message}</p>}
                </div>
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">District</label>
                  <input type="text" {...register("district")} className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none" />
                  {errors.district && <p className="text-red-500 mt-1 text-sm">{errors.district.message}</p>}
                </div>
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">State</label>
                  <select {...register("state")} className="w-full p-4 bg-edex-charcoal border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none text-white appearance-none">
                    <option value="">Select State</option>
                    <option value="Kerala">Kerala</option>
                    <option value="Andhra Pradesh">Andhra Pradesh</option>
                    <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                    <option value="Assam">Assam</option>
                    <option value="Bihar">Bihar</option>
                    <option value="Chhattisgarh">Chhattisgarh</option>
                    <option value="Goa">Goa</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Haryana">Haryana</option>
                    <option value="Himachal Pradesh">Himachal Pradesh</option>
                    <option value="Jharkhand">Jharkhand</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Madhya Pradesh">Madhya Pradesh</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Manipur">Manipur</option>
                    <option value="Meghalaya">Meghalaya</option>
                    <option value="Mizoram">Mizoram</option>
                    <option value="Nagaland">Nagaland</option>
                    <option value="Odisha">Odisha</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Sikkim">Sikkim</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Telangana">Telangana</option>
                    <option value="Tripura">Tripura</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Uttarakhand">Uttarakhand</option>
                    <option value="West Bengal">West Bengal</option>
                  </select>
                  {errors.state && <p className="text-red-500 mt-1 text-sm">{errors.state.message}</p>}
                </div>
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">Pincode</label>
                  <input type="text" {...register("pincode")} className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none" />
                  {errors.pincode && <p className="text-red-500 mt-1 text-sm">{errors.pincode.message}</p>}
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm mb-2 text-edex-white/70">Highest Qualification</label>
                  <select {...register("highestQualification")} className="w-full p-4 bg-edex-charcoal border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none text-white">
                    <option value="">Select Qualification</option>
                    <option value="UG">UG</option>
                    <option value="PG">PG</option>
                    <option value="SSLC">SSLC</option>
                    <option value="+2">+2</option>
                    <option value="Custom">Custom</option>
                  </select>
                  {errors.highestQualification && <p className="text-red-500 mt-1 text-sm">{errors.highestQualification.message}</p>}
                </div>
                
                {highestQualification === "Custom" && (
                  <div>
                    <label className="block text-sm mb-2 text-edex-white/70">Specify Qualification</label>
                    <input type="text" {...register("customQualification")} className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none" />
                    <p className="text-edex-white/50 text-xs mt-1">Must be text only, no numbers.</p>
                    {errors.customQualification && <p className="text-red-500 mt-1 text-sm">{errors.customQualification.message}</p>}
                  </div>
                )}
              </div>
            )}

            {currentStep === 6 && (
              <div className="space-y-8">
                <div className="p-6 border border-edex-white/20 rounded-xl bg-edex-white/5">
                  <h3 className="text-xl font-bold mb-4">Application Summary</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-edex-white/50">Program</div>
                      <div className="font-bold">{watch("program")}</div>
                    </div>
                    <div>
                      <div className="text-edex-white/50">Applicant</div>
                      <div className="font-bold">{watch("firstName")} {watch("lastName")}</div>
                    </div>
                    <div>
                      <div className="text-edex-white/50">Email</div>
                      <div className="font-bold">{watch("email")}</div>
                    </div>
                    <div>
                      <div className="text-edex-white/50">Mobile</div>
                      <div className="font-bold">{watch("mobile")}</div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border border-edex-neon rounded-xl bg-edex-neon/5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Application Fee</h3>
                    <div className="text-2xl font-bold text-edex-neon">₹1,000</div>
                  </div>
                  <p className="text-sm text-edex-white/70">
                    You will be redirected to verify your email and complete the payment securely via Razorpay.
                  </p>
                </div>

                <label className="flex items-start gap-4 cursor-pointer">
                  <input type="checkbox" className="mt-1" required />
                  <span className="text-sm text-edex-white/70">
                    I agree to the Terms & Conditions and Privacy Policy of EDEX Life School. I confirm that all information provided is accurate.
                  </span>
                </label>

                {/* OTP Section */}
                <AnimatePresence>
                  {otpStep !== "idle" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-6 border border-edex-white/20 rounded-xl bg-edex-white/5 space-y-4"
                    >
                      <h3 className="text-xl font-bold">Email Verification</h3>
                      {otpStep === "sending" && <p className="text-sm text-edex-white/70 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP to {watch("email")}...</p>}
                      {(otpStep === "sent" || otpStep === "verifying") && (
                        <div className="space-y-4">
                          <p className="text-sm text-edex-white/70">Enter the 6-digit code sent to {watch("email")}</p>
                          <input
                            type="text"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                            className="w-full p-4 bg-transparent border border-edex-white/20 rounded-lg focus:border-edex-neon focus:outline-none text-center tracking-widest text-xl"
                            placeholder="000000"
                          />
                          {otpError && <p className="text-red-500 text-sm">{otpError}</p>}
                          <button
                            type="button"
                            onClick={handleVerifyOTP}
                            disabled={otp.length !== 6 || otpStep === "verifying"}
                            className="w-full py-3 bg-edex-white text-edex-charcoal font-bold rounded-lg hover:opacity-90 disabled:opacity-50 flex justify-center items-center gap-2"
                          >
                            {otpStep === "verifying" && <Loader2 className="w-4 h-4 animate-spin" />}
                            Verify OTP
                          </button>
                        </div>
                      )}
                      {otpStep === "verified" && (
                        <p className="text-green-400 text-sm font-bold flex items-center gap-2">
                          ✓ Email Verified
                        </p>
                      )}
                      {otpStep === "processing_payment" && (
                        <p className="text-edex-neon text-sm font-bold flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Preparing Checkout...
                        </p>
                      )}
                      {paymentError && <p className="text-red-500 text-sm">{paymentError}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {Object.keys(errors).length > 0 && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm font-bold mt-4">
                    Please go back and fix the following fields: {Object.keys(errors).join(', ')}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {otpError && otpStep === "idle" && (
          <p className="text-red-500 mt-4 font-bold text-center bg-red-500/10 p-4 rounded-lg border border-red-500/20">{otpError}</p>
        )}

        <div className="mt-12 flex justify-between">
          {currentStep > 0 ? (
            <button 
              type="button" 
              onClick={prevStep}
              className="px-8 py-3 border border-edex-white/20 rounded-full font-bold hover:bg-edex-white/10 transition-colors"
            >
              Back
            </button>
          ) : <div></div>}
          
          {currentStep < steps.length - 1 ? (
            <button 
              type="button" 
              onClick={nextStep}
              className="px-8 py-3 bg-edex-neon text-edex-charcoal rounded-full font-bold hover:bg-white transition-colors"
            >
              Continue
            </button>
          ) : (
            otpStep === "idle" ? (
              <button 
                type="submit"
                className="px-8 py-3 bg-edex-neon text-edex-charcoal rounded-full font-bold hover:bg-white transition-colors"
              >
                Verify & Pay ₹1,000
              </button>
            ) : otpStep === "verified" ? (
              <button 
                type="button"
                onClick={() => initiatePayment(watch())}
                className="px-8 py-3 bg-edex-neon text-edex-charcoal rounded-full font-bold hover:bg-white transition-colors"
              >
                Retry Payment
              </button>
            ) : <div />
          )}
        </div>
      </form>
    </div>
  );
}
