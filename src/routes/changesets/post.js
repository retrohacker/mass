const log = require("../../log");

module.exports = (request, response, next) => {
    log.info({ body: request.body }, "got request");

    // Convienence wrapper for rejecting invalid payloads
    const invalid = (msg) => {
      const err = new Error(msg);
      err.statusCode = 400;
      return next(err);
    }

    if(request.body === undefined) {
      return invalid("Expected JSON post body");
    }

    const { name, image, stakeholders } = request.body;

    // First validate our payload
    if(name === undefined) {
      return invalid("name is a required field");
    }
    if((typeof name) !== "string") {
      return invalid("name must be a string");
    }
    if(image === undefined) {
      return invalid("image is a required field");
    }
    if((typeof image) !== "string") {
      return invalid("image must be a string");
    }
    if(stakeholders === undefined) {
      return invalid("stakeholders is a required field");
    }
    if(!Array.isArray(stakeholders)) {
      return invalid("stakeholders must be an array");
    }
    if(!stakeholders.reduce((a, v) => a && (typeof(v) === "string"), true)) {
      return invalid("stakeholders must be an array of strings");
    }

    // Payload is valid
    response.header("content-type", "application/json")
    response.send(request.body);
    next();
}
