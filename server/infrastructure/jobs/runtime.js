let jobQueuesRuntime = null;

function setJobQueuesRuntime(runtime) {
  jobQueuesRuntime = runtime || null;
}

function getJobQueuesRuntime() {
  return jobQueuesRuntime;
}

function clearJobQueuesRuntime() {
  jobQueuesRuntime = null;
}

module.exports = {
  setJobQueuesRuntime,
  getJobQueuesRuntime,
  clearJobQueuesRuntime,
};
