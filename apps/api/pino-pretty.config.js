module.exports = {
  customPrettifiers: {
    res: (res, key, log, { colors }) => {
      try {
        return '{ \n' +
          Object.entries(res).map(([key, val]) => {
            let value = val;
            if (key === 'statusCode') {
              value = val >= 500 ? `${colors.red(val)}` :
                val >= 400 ? `${colors.yellow(val)}` :
                val >= 300 ? `${colors.cyan(val)}` :
                val >= 200 ? `${colors.blue(val)}` :
                val;
            }
            return `  ${key}: ${value},\n`
          }).join('')
        + '}';
      } catch (err) {
        console.error('Error prettifying response', err);
        return JSON.stringify(res, null, 2);
      }
    },
    responseTime: (time, k, l, { colors }) => {
      return time > 50 ? `${colors.red(time)}` :
        time > 20 ? `${colors.yellow(time)}` :
        String(time)
    }
  }
}
