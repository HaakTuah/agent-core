// A Python package's name as pip compares it (PEP 503), for the shape check's reader of what a project declares
// (shape-python.mjs) and the lookup's reader of a requirements file (lookup-pypi.mjs).
export const normal = (name) => name.toLowerCase().replace(/[-_.]+/gu, "-");
