// This function is triggered when a form is submitted to Netlify
exports.handler = async function(event, context) {
  // Log the submission for debugging
  console.log('Form submission received!', JSON.parse(event.body));
  
  // Process the form submission as needed
  // For example, you could send an email, store in a database, etc.
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Form submission successful" })
  };
};
