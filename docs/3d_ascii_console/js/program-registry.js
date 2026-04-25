export function createProgramRegistry(programs) {
  const byId = {};
  const commandMap = {};

  programs.forEach((program) => {
    byId[program.id] = program;
    commandMap[program.command] = program;
  });

  return {
    list: programs,
    byId,
    commandMap
  };
}
