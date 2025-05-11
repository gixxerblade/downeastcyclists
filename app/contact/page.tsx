'use client';

import { useRouter } from 'next/navigation';
import { Container, Typography } from '@mui/material';
import { useForm, SubmitHandler } from "react-hook-form";
import HCaptcha from '@hcaptcha/react-hcaptcha';

type FormInputs = {
  name: string;
  email: string;
  message: string;
  'h-captcha-response': string;
};

export default function Contact () {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<FormInputs>();

  const onHCaptchaChange = (token: string) => {
    setValue("h-captcha-response", token);
  };

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    // Create FormData for Netlify
    const formData = new FormData();
    
    // Add form-name field which Netlify requires
    formData.append("form-name", "contact");
    
    // Add all form fields
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value);
    });

    try {
      // Submit to Netlify forms
      const response = await fetch("/", {
        method: "POST",
        body: formData
      });
      
      if (response.ok) {
        router.push('/thanks');
      } else {
        // Handle error
        console.error("Form submission error:", response);
        router.push('/thanks?error=true');
      }
    } catch (error) {
      console.error("Form submission error:", error);
      router.push('/thanks?error=true');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ paddingTop: 8, paddingBottom: 8 }}>
      <div className="text-center">
        <Typography variant="h3" component="h1" gutterBottom align="center">
          Contact Us
        </Typography>

        <div className="flex flex-col md:flex-row justify-center">
          <div className="md:w-3/5 mx-auto">
            <form
              className="form"
              onSubmit={handleSubmit(onSubmit)}
              data-netlify="true"
              name="contact"
              method="POST"
              netlify-honeypot="bot-field"
            >
              <input type="hidden" name="form-name" value="contact" />
              <p className="hidden">
                <label>
                  Don&apos;t fill this out if you&apos;re human: <input name="bot-field" />
                </label>
              </p>
              <div className="mb-4">
                <label className="block text-left mb-2" htmlFor="name">
                  Name
                  <div className="mt-1">
                    <input
                      id="name"
                      placeholder="Tadej Pogačar"
                      className={`w-full p-3 border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                      {...register("name", { required: "Name is required" })}
                    />
                    {errors.name && (
                      <p className="text-red-500 text-sm mt-1 text-left">{errors.name.message}</p>
                    )}
                  </div>
                </label>
              </div>

              <div className="mb-4">
                <label className="block text-left mb-2" htmlFor="email">
                  Email
                  <div className="mt-1">
                    <input
                      id="email"
                      type="email"
                      placeholder="info@tadejpogacar.com"
                      className={`w-full p-3 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                      {...register("email", {
                        required: "Email is required",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address"
                        }
                      })}
                    />
                    {errors.email && (
                      <p className="text-red-500 text-sm mt-1 text-left">{errors.email.message}</p>
                    )}
                  </div>
                </label>
              </div>

              <div className="mb-4">
                <label className="block text-left mb-2" htmlFor="message">
                  Message
                  <div className="mt-1">
                    <textarea
                      id="message"
                      placeholder="Enter your message here..."
                      className={`w-full p-3 border ${errors.message ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                      rows={5}
                      style={{ height: '125px' }}
                      {...register("message", {
                        required: "Message is required",
                      })}
                    ></textarea>
                    {errors.message && (
                      <p className="text-red-500 text-sm mt-1 text-left">{errors.message.message}</p>
                    )}
                  </div>
                </label>
              </div>

              <div className="mt-6">
                <HCaptcha
                  sitekey="50b2fe65-b00b-4b9e-ad62-3ba471098be2"
                  reCaptchaCompat={false}
                  onVerify={onHCaptchaChange}
                />
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Container>
  );
}
