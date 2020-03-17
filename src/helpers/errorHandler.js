const dbError = error => {
  if (error.errors) {
    throw new Error(error.errors);
  }
  throw new Error(error.message);
};

module.exports = {
  dbError
};
