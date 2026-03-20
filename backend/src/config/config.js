// Define environment variables, ports, node roles
export const config = {
    role: process.env.ROLE || 'follower',
    port: process.env.PORT || 3001,
    leader: {
        url: process.env.URL || 'http://localhost:3001'
    },
    followers: [
        process.env.FOLLOWER1_URL || 'http://localhost:3002',
        process.env.FOLLOWER2_URL || 'http://localhost:3003'
    ]
}