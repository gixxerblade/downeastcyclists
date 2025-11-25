"use client";

import { useRouter } from "next/navigation";
import { Container, Typography } from "@mui/material";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type FormInputs = {
  name: string;
  email: string;
  message: string;
};

const schema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  message: z.string().min(1, { message: "Message is required" }),
});

export default function Contact() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInputs>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    try {
      // Create form data for Netlify submission following OpenNext docs
      const formData = new FormData();
      formData.append("form-name", "contact");
      formData.append("bot-field", ""); // Honeypot field
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, value);
      });

      // For local development with netlify dev, submit to root
      // For production, this will be handled by Netlify's form processing
      const response = await fetch("/__forms.html", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData as any).toString(),
      });

      // console.log("Form submission response:", response);

      if (response.ok) {
        router.push("/thanks");
      } else {
        console.error("Form submission error:", await response.text());
        router.push("/thanks?error=true");
      }
    } catch (error) {
      console.error("Form submission error:", error);
      router.push("/thanks?error=true");
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
              data-netlify-recaptcha="true"
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
                      className={`w-full p-3 border ${errors.name ? "border-red-500" : "border-gray-300"} rounded-md`}
                      {...register("name")}
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
                      className={`w-full p-3 border ${errors.email ? "border-red-500" : "border-gray-300"} rounded-md`}
                      {...register("email")}
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
                      className={`w-full p-3 border ${errors.message ? "border-red-500" : "border-gray-300"} rounded-md`}
                      rows={5}
                      style={{ height: "125px" }}
                      {...register("message")}
                    ></textarea>
                    {errors.message && (
                      <p className="text-red-500 text-sm mt-1 text-left">
                        {errors.message.message}
                      </p>
                    )}
                  </div>
                </label>
              </div>
              {/* Netlify reCAPTCHA - this div must be empty for Netlify to inject the reCAPTCHA */}
              <div className="mb-4" data-netlify-recaptcha="true"></div>
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
