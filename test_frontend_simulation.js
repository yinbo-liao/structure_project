// Simulating the frontend behavior
const result = {
  success: true,
  project_id: 1,
  project_name: "HDV windfarm project",
  total_joints: 23,
  synced_joints: 0,
  failed_joints: 0,
  details: [],
  skipped_joints: 23,
  synced_count: 0,
  skipped_count: 23
};

console.log("Result object:", result);
console.log("result.synced_count:", result.synced_count);
console.log("result.skipped_count:", result.skipped_count);
console.log("Message:", `Auto NDT sync completed: ${result.synced_count} joints updated, ${result.skipped_count} skipped`);

// Check if fields are undefined
console.log("Is synced_count undefined?", result.synced_count === undefined);
console.log("Is skipped_count undefined?", result.skipped_count === undefined);

// Check if fields exist
console.log("Has synced_count?", 'synced_count' in result);
console.log("Has skipped_count?", 'skipped_count' in result);